import * as Dialog from '@radix-ui/react-dialog';
import { Settings, X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../utils';

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-ide-border/40">
      <div>
        <div className="text-[13px] text-ide-text">{label}</div>
        {description && <div className="text-[11px] text-ide-text-dim mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors shrink-0',
          checked ? 'bg-ide-accent' : 'bg-[#3e3e3e]',
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step = 1, onChange }: SliderProps) {
  return (
    <div className="py-3 border-b border-ide-border/40">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] text-ide-text">{label}</div>
        <span className="text-[12px] text-ide-accent font-mono font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer accent-ide-accent"
      />
      <div className="flex justify-between text-[10px] text-ide-text-dim mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function SettingsDialog() {
  const { settingsOpen, closeSettings, editorSettings, updateEditorSettings } = useUIStore();

  return (
    <Dialog.Root open={settingsOpen} onOpenChange={v => !v && closeSettings()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-[200] animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] bg-[#252526] border border-ide-border shadow-2xl w-[440px] max-w-[95vw] animate-slide-in">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ide-border">
            <Dialog.Title className="text-[14px] font-semibold text-ide-text flex items-center gap-2">
              <Settings size={15} className="text-ide-accent" />
              Editor Settings
            </Dialog.Title>
            <Dialog.Close className="p-1 text-ide-text-dim hover:text-ide-text transition-colors rounded hover:bg-ide-hover">
              <X size={15} />
            </Dialog.Close>
          </div>

          <div className="px-5 py-2 max-h-[70vh] overflow-y-auto">
            <div className="text-[10px] font-semibold text-ide-text-dim uppercase tracking-widest py-2">
              Appearance
            </div>

            <Slider
              label="Font Size"
              value={editorSettings.fontSize}
              min={11}
              max={22}
              onChange={v => updateEditorSettings({ fontSize: v })}
            />

            <Slider
              label="Tab Size"
              value={editorSettings.tabSize}
              min={2}
              max={8}
              step={2}
              onChange={v => updateEditorSettings({ tabSize: v })}
            />

            <div className="text-[10px] font-semibold text-ide-text-dim uppercase tracking-widest py-2 mt-2">
              Behavior
            </div>

            <Toggle
              label="Word Wrap"
              description="Wrap long lines at viewport edge"
              checked={editorSettings.wordWrap}
              onChange={v => updateEditorSettings({ wordWrap: v })}
            />

            <Toggle
              label="Minimap"
              description="Show code minimap on the right"
              checked={editorSettings.minimap}
              onChange={v => updateEditorSettings({ minimap: v })}
            />

            <Toggle
              label="Line Numbers"
              description="Show line numbers in the gutter"
              checked={editorSettings.lineNumbers}
              onChange={v => updateEditorSettings({ lineNumbers: v })}
            />

            <Toggle
              label="Format on Save"
              description="Auto-format code when saving (Ctrl+S)"
              checked={editorSettings.formatOnSave}
              onChange={v => updateEditorSettings({ formatOnSave: v })}
            />
          </div>

          <div className="px-5 py-3 border-t border-ide-border bg-[#1e1e1e] flex items-center justify-between">
            <span className="text-[11px] text-ide-text-dim">Changes apply instantly</span>
            <button
              onClick={closeSettings}
              className="px-4 py-1.5 bg-ide-accent hover:bg-[#1a8ad4] text-white text-[13px] transition-colors"
            >
              Done
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
