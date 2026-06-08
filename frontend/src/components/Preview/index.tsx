import { useUIStore } from '../../stores/uiStore';

export function PreviewPanel() {
  const { previewUrl } = useUIStore();

  return (
    <div className="h-full w-full bg-white flex flex-col">
      <div className="h-8 bg-ide-bg-lighter flex items-center px-3 text-[11px] text-ide-text-muted border-b border-ide-border shrink-0">
        Preview {previewUrl && `— ${previewUrl}`}
      </div>
      {previewUrl ? (
        <iframe src={previewUrl} className="flex-1 w-full border-0" title="Preview" sandbox="allow-scripts allow-same-origin allow-forms" />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-ide-bg text-ide-text-dim text-sm">
          No preview URL set. Start a dev server to see a preview.
        </div>
      )}
    </div>
  );
}
