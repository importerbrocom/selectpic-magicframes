<?php

namespace App\Services;

use RuntimeException;

/**
 * Minimal streaming ZIP writer that emits a valid archive to php://output as
 * files are added, without ever holding a whole file (or the whole archive)
 * in memory. Uses the STORE method (no compression) — wedding photos are
 * already compressed, so this costs nothing and lets us stream.
 *
 * Why not ZipArchive? ZipArchive::close() buffers everything and only writes
 * at the end, which both exhausts memory and delays the first byte until the
 * whole gallery is fetched — on shared hosting that trips the web server's
 * request timeout. Streaming keeps the connection active and memory flat.
 */
class ZipStreamWriter
{
    /** @var array<int, array<string, mixed>> central-directory records */
    private array $records = [];

    private int $offset = 0;

    private mixed $out;

    public function __construct()
    {
        $this->out = fopen('php://output', 'wb');
        if ($this->out === false) {
            throw new RuntimeException('Cannot open output stream.');
        }
    }

    /**
     * Add one file to the archive, streaming its bytes from a local path.
     */
    public function addFile(string $name, string $path): void
    {
        $size = (int) filesize($path);
        $crc = (int) hexdec(hash_file('crc32b', $path));
        $name = $this->sanitize($name);
        $nameLen = strlen($name);
        $mtime = $this->dosTime(time());

        // Local file header (signature 0x04034b50).
        $header = pack('V', 0x04034b50)
            . pack('v', 20)          // version needed
            . pack('v', 0x0800)      // flags: UTF-8 filename
            . pack('v', 0)           // method: store
            . pack('V', $mtime)      // mod time + date
            . pack('V', $crc)        // crc-32
            . pack('V', $size)       // compressed size
            . pack('V', $size)       // uncompressed size
            . pack('v', $nameLen)
            . pack('v', 0)           // extra field length
            . $name;

        $this->write($header);

        // Stream the file body in chunks.
        $in = fopen($path, 'rb');
        if ($in === false) {
            throw new RuntimeException('Cannot read ' . $path);
        }
        while (! feof($in)) {
            $chunk = fread($in, 262144);
            if ($chunk === false) {
                break;
            }
            $this->write($chunk);
        }
        fclose($in);

        $this->records[] = [
            'name' => $name,
            'crc' => $crc,
            'size' => $size,
            'offset' => $this->offset,
            'mtime' => $mtime,
            'nameLen' => $nameLen,
        ];

        $this->offset += strlen($header) + $size;
    }

    /** Write the central directory and end-of-archive record. */
    public function finish(): void
    {
        $cdStart = $this->offset;
        $cdSize = 0;

        foreach ($this->records as $r) {
            $record = pack('V', 0x02014b50) // central dir signature
                . pack('v', 20)             // version made by
                . pack('v', 20)             // version needed
                . pack('v', 0x0800)         // flags: UTF-8
                . pack('v', 0)              // method: store
                . pack('V', $r['mtime'])
                . pack('V', $r['crc'])
                . pack('V', $r['size'])     // compressed
                . pack('V', $r['size'])     // uncompressed
                . pack('v', $r['nameLen'])
                . pack('v', 0)              // extra len
                . pack('v', 0)              // comment len
                . pack('v', 0)              // disk number
                . pack('v', 0)              // internal attrs
                . pack('V', 0)              // external attrs
                . pack('V', $r['offset'])   // local header offset
                . $r['name'];
            $this->write($record);
            $cdSize += strlen($record);
        }

        $count = count($this->records);
        $end = pack('V', 0x06054b50) // end of central dir signature
            . pack('v', 0)           // this disk
            . pack('v', 0)           // cd start disk
            . pack('v', $count)      // records on this disk
            . pack('v', $count)      // total records
            . pack('V', $cdSize)
            . pack('V', $cdStart)
            . pack('v', 0);          // comment length
        $this->write($end);

        fflush($this->out);
    }

    private function write(string $bytes): void
    {
        fwrite($this->out, $bytes);
    }

    /** DOS date/time packed into a single 32-bit value. */
    private function dosTime(int $ts): int
    {
        $d = getdate($ts);
        $year = max(1980, $d['year']);
        $dosDate = (($year - 1980) << 9) | ($d['mon'] << 5) | $d['mday'];
        $dosTime = ($d['hours'] << 11) | ($d['minutes'] << 5) | ((int) ($d['seconds'] / 2));

        return ($dosDate << 16) | $dosTime;
    }

    /** Keep names safe inside the archive (no leading slash / traversal). */
    private function sanitize(string $name): string
    {
        $name = str_replace('\\', '/', $name);
        $name = ltrim($name, '/');
        $name = str_replace('../', '', $name);

        return $name !== '' ? $name : 'photo';
    }
}
