import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import type { Choice, DriveImage, GroupedSelections, Project } from './types';
import { ProjectBar } from './components/ProjectBar';
import { DriveToolbar } from './components/DriveToolbar';
import { Gallery } from './components/Gallery';
import { SelectionSummary } from './components/SelectionSummary';

const EMPTY_SELECTIONS: GroupedSelections = { bride: [], groom: [] };

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [images, setImages] = useState<DriveImage[]>([]);
  const [selections, setSelections] = useState<GroupedSelections>(EMPTY_SELECTIONS);

  const [loadingImages, setLoadingImages] = useState(false);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the project list on mount.
  useEffect(() => {
    api
      .listProjects()
      .then((res) => setProjects(res.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  // Load selections whenever the active project changes.
  const loadSelections = useCallback((projectId: number) => {
    api
      .getSelections(projectId)
      .then((res) => setSelections(res.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (activeProject) {
      loadSelections(activeProject.id);
    } else {
      setSelections(EMPTY_SELECTIONS);
    }
  }, [activeProject, loadSelections]);

  async function handleCreateProject(payload: {
    name: string;
    google_drive_folder_id?: string;
    bride_name?: string;
    groom_name?: string;
  }) {
    setError(null);
    try {
      const res = await api.createProject(payload);
      setProjects((prev) => [res.data, ...prev]);
      setActiveProject(res.data);
      setImages([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleSelectProject(project: Project) {
    setActiveProject(project);
    setImages([]);
    setError(null);
  }

  async function handleFetchImages(folderId: string) {
    if (!activeProject) return;
    setLoadingImages(true);
    setError(null);
    try {
      const res = await api.fetchDriveImages({
        folder_id: folderId,
        project_id: activeProject.id,
      });
      setImages(res.data);
    } catch (e) {
      setError((e as Error).message);
      setImages([]);
    } finally {
      setLoadingImages(false);
    }
  }

  async function handleToggle(image: DriveImage, choice: Choice) {
    if (!activeProject) return;
    setBusyFileId(image.file_id);
    setError(null);
    try {
      await api.saveSelection(activeProject.id, {
        file_id: image.file_id,
        file_name: image.name,
        thumbnail_link: image.thumbnail_link ?? image.image_url,
        choice,
      });
      // Re-sync from the server so the two sides stay authoritative.
      loadSelections(activeProject.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyFileId(null);
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>
          <span className="app__title-accent">SelectPic</span> MagicFrames
        </h1>
        <p className="app__subtitle">Pick the perfect frames — bride &amp; groom, side by side.</p>
      </header>

      <ProjectBar
        projects={projects}
        activeProject={activeProject}
        onSelect={handleSelectProject}
        onCreate={handleCreateProject}
      />

      {error && <div className="alert alert--error">{error}</div>}

      {activeProject ? (
        <>
          <DriveToolbar
            project={activeProject}
            onFetch={handleFetchImages}
            loading={loadingImages}
          />

          <SelectionSummary project={activeProject} selections={selections} />

          <main className="app__gallery">
            <Gallery
              images={images}
              selections={selections}
              onToggle={handleToggle}
              loading={loadingImages}
              busyFileId={busyFileId}
            />
          </main>
        </>
      ) : (
        <p className="app__empty">Create or select a project to get started.</p>
      )}
    </div>
  );
}
