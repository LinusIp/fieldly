import { useId, type ReactNode } from 'react';
import { useProgress } from '../../storage/progress';
import type { Settings } from '../../storage/schema';

function RadioGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange(v: T): void;
  name: string;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-2">
      <legend id={id} className="font-semibold">
        {label}
      </legend>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={String(o.value)}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
              value === o.value
                ? 'border-primary bg-surface-tint font-semibold text-primary-ink'
                : 'border-outline'
            }`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {value === o.value && <span aria-hidden="true">✓</span>}
            {o.label}
            {o.hint && <span className="text-xs font-normal text-ink-2">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border-2 border-outline bg-surface p-5">{children}</section>;
}

export default function SettingsPage() {
  const settings = useProgress((s) => s.progress.settings);
  const setSettings = useProgress((s) => s.setSettings);
  const set = (patch: Partial<Settings>) => setSettings(patch);
  const osReduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="mx-auto max-w-[760px] space-y-4 px-[18px] py-6 md:px-6">
      <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-display">
        Settings
      </h1>
      <p className="text-sm text-ink-2">Settings are saved in this browser along with your progress.</p>

      <Section>
        <RadioGroup
          label="Theme"
          name="theme"
          value={settings.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { value: 'system', label: 'System', hint: 'follows your device' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Section>

      <Section>
        <RadioGroup
          label="Text size"
          name="font"
          value={settings.fontScale}
          onChange={(fontScale) => set({ fontScale })}
          options={[
            { value: 0.875, label: 'Small' },
            { value: 1, label: 'Default' },
            { value: 1.125, label: 'Large' },
            { value: 1.25, label: 'Larger' },
          ]}
        />
        <p className="mt-3 text-sm text-ink-2" style={{ fontSize: `${settings.fontScale}em` }}>
          Preview: a 6 V battery drives 2 A through a 3 Ω resistor.
        </p>
      </Section>

      <Section>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => set({ reducedMotion: e.target.checked })}
            className="mt-1 h-4 w-4 accent-[var(--primary)]"
          />
          <span>
            <span className="font-semibold">Reduce motion</span>
            <span className="block text-sm text-ink-2">
              Turns off animations such as the current flow in circuits.
              {osReduced && ' Your device already asks for reduced motion, so animations are off either way.'}
            </span>
          </span>
        </label>
      </Section>

      <Section>
        <RadioGroup
          label="Preferred code language"
          name="codelang"
          value={settings.codeLang}
          onChange={(codeLang) => set({ codeLang })}
          options={[
            { value: 'python', label: 'Python' },
            { value: 'javascript', label: 'JavaScript' },
          ]}
        />
        <p className="mt-2 text-sm text-ink-2">Used as the starting language in coding challenges.</p>
      </Section>
    </div>
  );
}
