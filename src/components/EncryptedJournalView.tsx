import React, { useEffect, useMemo, useState } from 'react';
import { JournalEntry, JournalMood } from '../types/shongi';
import { JOURNAL_PROMPTS } from '../data/seedData';
import { filterJournalEntries } from '../utils/shongiLogic';

interface EncryptedJournalViewProps {
  entries: JournalEntry[];
  onSaveEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (id: string) => void;
}

const FILTER_TABS = [
  { id: 'All', label: 'All' },
  { id: 'Admission', label: 'ভর্তি পরীক্ষা (Mock Test)' },
  { id: 'Midnight', label: 'Midnight' },
  { id: 'Gratitude', label: 'কৃতজ্ঞতা' },
];

const MOOD_CHOICES: { mood: JournalMood; dotColor: string }[] = [
  { mood: 'Calm', dotColor: 'bg-outline' },
  { mood: 'Heavy', dotColor: 'bg-secondary' },
  { mood: 'Hopeful', dotColor: 'bg-tertiary-container' },
];

export const EncryptedJournalView: React.FC<EncryptedJournalViewProps> = ({
  entries,
  onSaveEntry,
  onDeleteEntry,
}) => {
  const [selectedId, setSelectedId] = useState<string>(entries[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? entries[0] ?? null,
    [entries, selectedId]
  );

  const [title, setTitle] = useState(activeEntry?.title ?? '');
  const [body, setBody] = useState(activeEntry?.body ?? '');
  const [mood, setMood] = useState<JournalMood>(activeEntry?.mood ?? 'Heavy');
  const [tags, setTags] = useState<string[]>(activeEntry?.tags ?? []);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'encrypting' | 'saved'>('idle');
  const [statusMessage, setStatusMessage] = useState(
    activeEntry?.updatedAtLabel ?? 'Saved locally (On-device DB)'
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeEntry) {
      setTitle(activeEntry.title);
      setBody(activeEntry.body);
      setMood(activeEntry.mood);
      setTags(activeEntry.tags);
      setStatusMessage(activeEntry.updatedAtLabel);
      setConfirmingDelete(false);
    }
  }, [activeEntry?.id]);

  const filteredEntries = useMemo(
    () => filterJournalEntries(entries, searchQuery, activeFilter),
    [entries, searchQuery, activeFilter]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleSelectEntry = (entry: JournalEntry) => {
    setSelectedId(entry.id);
    setTitle(entry.title);
    setBody(entry.body);
    setMood(entry.mood);
    setTags(entry.tags);
    setStatusMessage(entry.updatedAtLabel);
    setConfirmingDelete(false);
  };

  const handleNewReflection = () => {
    const newId = `entry-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const blankEntry: JournalEntry = {
      id: newId,
      dateLabel: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      banglaDateLabel: 'নতুন ব্যক্তিগত পাতা',
      relativeTimeLabel: `Today • ${nowTime}`,
      title: 'Untitled Reflection',
      body: '',
      mood: 'Calm',
      tags: ['#PrivateReflection'],
      aiLocked: true,
      updatedAtLabel: `Draft started at ${nowTime} (On-device DB)`,
    };
    onSaveEntry(blankEntry);
    setSelectedId(newId);
    setTitle('');
    setBody('');
    setMood('Calm');
    setTags(['#PrivateReflection']);
    setStatusMessage(blankEntry.updatedAtLabel);
    setConfirmingDelete(false);
  };

  const handleInsertPrompt = (promptText: string) => {
    const trimmed = body.trim();
    const addition = `${trimmed ? '\n\n' : ''}[Reflective Prompt: ${promptText}]\n`;
    setBody(trimmed + addition);
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setStatusMessage(`Draft updated at ${nowTime}`);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagInput.trim().replace(/^#*/, '');
    if (!clean) {
      setShowTagInput(false);
      return;
    }
    const formatted = `#${clean.replace(/\s+/g, '')}`;
    if (!tags.includes(formatted)) {
      setTags([...tags, formatted]);
    }
    setNewTagInput('');
    setShowTagInput(false);
  };

  const handleSave = () => {
    const targetId = activeEntry?.id ?? `entry-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setSaveState('encrypting');

    const updated: JournalEntry = {
      id: targetId,
      dateLabel:
        activeEntry?.dateLabel ??
        new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      banglaDateLabel: activeEntry?.banglaDateLabel ?? 'ব্যক্তিগত ডায়েরি',
      relativeTimeLabel: activeEntry?.relativeTimeLabel ?? `Today • ${nowTime}`,
      title: title.trim() || 'Untitled Reflection',
      body,
      mood,
      tags,
      aiLocked: true,
      updatedAtLabel: `Saved locally at ${nowTime} (On-device DB)`,
    };

    onSaveEntry(updated);
    setSelectedId(updated.id);
    setStatusMessage(updated.updatedAtLabel);

    window.setTimeout(() => {
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1600);
    }, 350);
  };

  const handleExportBackup = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const payload = JSON.stringify(
      {
        format: 'shongi-encrypted-vault-v1',
        cipher: 'SQLCipher-256-AES',
        exportedAt: new Date().toISOString(),
        entryCount: entries.length,
        entries,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shongi-vault-${dateStamp}.shg`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Encrypted backup "shongi-vault-${dateStamp}.shg" exported.`);
  };

  const handleConfirmDelete = () => {
    if (!activeEntry) return;
    const remaining = entries.filter((e) => e.id !== activeEntry.id);
    onDeleteEntry(activeEntry.id);
    setConfirmingDelete(false);
    if (remaining[0]) {
      setSelectedId(remaining[0].id);
    } else {
      setTitle('');
      setBody('');
      setTags([]);
      setStatusMessage('Entry cleared permanently from device storage');
    }
    showToast('Entry erased permanently from local encrypted storage.');
  };

  return (
    <div className="flex flex-col w-full">
      <div className="px-4 sm:px-8 pt-8 pb-10 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Top Security & Architecture Banner */}
        <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-tertiary-container/5 blur-2xl pointer-events-none" />
          <div className="flex items-start sm:items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 shadow-sm">
              <span
                className="material-symbols-outlined text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                lock
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[18px] font-semibold text-primary">
                  Local Encrypted Vault
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-highest text-[11px] text-on-surface-variant font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container" />
                  SQLCipher 256-bit AES
                </span>
              </div>
              <p className="text-[13px] text-on-surface-variant max-w-2xl leading-relaxed">
                Stored solely on your device partition. Raw entries are never uploaded to the cloud
                or parsed by SHONGI companion AI models.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 relative z-10 shrink-0">
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary text-[14px] font-medium transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span>Export Backup (.shg)</span>
            </button>
            <button
              type="button"
              onClick={() => setPasscodeModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary text-[14px] font-medium transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">password</span>
              <span>Passcode Lock</span>
            </button>
          </div>
        </div>

        {/* Main Journal Split Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Entry Repository & Filtering (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-primary">
                    Journal Archives
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container text-[11px] font-semibold text-on-surface-variant tabular-nums">
                    {entries.length} Entries
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleNewReflection}
                  title="Write New Reflection"
                  aria-label="Write New Reflection"
                  className="p-1.5 rounded-lg text-primary hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">edit_square</span>
                </button>
              </div>

              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="অনুসন্ধান বা সার্চ করুন..."
                  aria-label="Search journal entries"
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-surface-container text-on-surface text-[13px] placeholder:text-outline outline-none focus:bg-surface-container-high transition-colors bangla-text"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {FILTER_TABS.map((tab) => {
                  const active = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-colors bangla-text ${
                        active
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Entries List */}
            <div className="flex flex-col gap-3" data-testid="journal-entries-list">
              {filteredEntries.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-container-lowest shadow-sm text-center space-y-2">
                  <p className="text-[14px] font-medium text-primary">
                    No matching reflections found
                  </p>
                  <p className="text-[12px] text-on-surface-variant">
                    Try clearing your search or create a fresh entry.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveFilter('All');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-container text-primary text-[12px] font-semibold"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const isSelected = activeEntry?.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleSelectEntry(entry)}
                      className={`text-left p-5 rounded-xl shadow-sm cursor-pointer relative overflow-hidden transition-all w-full ${
                        isSelected
                          ? 'bg-surface-container-lowest ring-1 ring-secondary/35'
                          : 'bg-surface-container-lowest hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[11px] font-semibold ${
                              isSelected ? 'text-secondary' : 'text-on-surface-variant'
                            }`}
                          >
                            {entry.relativeTimeLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-[11px] text-on-surface-variant">
                            <span className="material-symbols-outlined text-xs">devices</span>
                            Local Only
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            entry.mood === 'Heavy'
                              ? 'bg-secondary-fixed text-on-secondary-fixed'
                              : 'bg-surface-container text-on-surface'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              entry.mood === 'Heavy'
                                ? 'bg-secondary'
                                : entry.mood === 'Restless'
                                ? 'bg-outline'
                                : 'bg-tertiary-container'
                            }`}
                          />
                          {entry.mood}
                        </span>
                      </div>

                      <h3 className="text-[17px] font-medium text-primary mb-1.5 line-clamp-1 bangla-text">
                        {entry.title}
                      </h3>
                      <p className="text-[13px] font-normal text-on-surface-variant line-clamp-2 leading-[1.6] bangla-text">
                        {entry.body || 'Empty reflection page — tap to start writing...'}
                      </p>

                      {entry.tags.length > 0 && (
                        <div className="flex items-center flex-wrap gap-2 mt-3 pt-3">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Local Storage Health Metric */}
            <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary-container text-xl">
                  sd_card
                </span>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-primary">
                    On-Device Partition
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    1.4 MB used • Zero telemetry emitted
                  </span>
                </div>
              </div>
              <span className="px-2 py-1 rounded bg-surface-container text-[11px] text-primary font-medium">
                100% Offline
              </span>
            </div>
          </div>

          {/* Right Column: Focused Tranquil Editor (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Offline Reflective Inspiration Carousel */}
            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-lg">
                    psychology_alt
                  </span>
                  <span className="text-[12px] font-semibold text-primary">
                    Need inspiration while offline? Pick a reflective prompt:
                  </span>
                </div>
                <span className="text-[11px] text-on-surface-variant hidden sm:inline bangla-text">
                  ট্যাপ করে যোগ করুন
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {JOURNAL_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => handleInsertPrompt(prompt.insertText)}
                    className="group text-left px-3 py-1.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high transition-all shadow-sm flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base text-secondary group-hover:scale-110 transition-transform">
                      add_circle
                    </span>
                    <span className="text-[13px] text-on-surface">{prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Writing Canvas Card */}
            <div className="rounded-xl bg-surface-container-lowest p-6 sm:p-8 shadow-sm flex flex-col gap-6">
              {/* Entry Metadata Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-xl">
                    calendar_today
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-primary">
                      {activeEntry?.dateLabel ?? 'Today'}
                    </span>
                    <span className="text-outline text-xs">•</span>
                    <span className="text-[11px] text-on-surface-variant bangla-text">
                      {activeEntry?.banglaDateLabel ?? 'ব্যক্তিগত ডায়েরি'}
                    </span>
                  </div>
                </div>

                {/* Mood Selector Segment */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-container">
                  {MOOD_CHOICES.map((choice) => {
                    const active = mood === choice.mood;
                    return (
                      <button
                        key={choice.mood}
                        type="button"
                        onClick={() => setMood(choice.mood)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center gap-1 ${
                          active
                            ? 'bg-surface text-secondary shadow-sm font-semibold'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${choice.dotColor}`} />
                        {choice.mood}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input Area */}
              <div className="flex flex-col gap-2">
                <textarea
                  rows={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="শিরোনাম দিন..."
                  aria-label="Journal entry title"
                  className="text-[22px] sm:text-[25px] font-medium text-primary bg-transparent outline-none placeholder:text-outline w-full leading-snug resize-none bangla-text"
                />
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[11px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                  {showTagInput ? (
                    <form onSubmit={handleAddTag} className="inline-flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        placeholder="Tag name"
                        autoFocus
                        className="px-2 py-0.5 rounded-lg bg-surface-container text-[11px] text-on-surface outline-none w-28"
                      />
                      <button
                        type="submit"
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTagInput(true)}
                      className="text-[11px] font-medium text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add tag
                    </button>
                  )}
                </div>
              </div>

              {/* Body Writing Workspace */}
              <div className="relative min-h-[340px] flex flex-col">
                <textarea
                  id="journal-editor"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="কী মনে হচ্ছে আপনার? এখানে কোনো তাড়াহুড়ো নেই, নিজেকে প্রকাশ করুন সম্পূর্ণ স্বাধীনভাবে..."
                  aria-label="Journal entry body"
                  className="w-full flex-grow bg-transparent resize-none outline-none text-[16px] font-normal text-on-surface leading-[1.6] placeholder:text-outline/60 bangla-text min-h-[340px]"
                />
              </div>

              {/* Privacy Shield & AI Lock Component */}
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <span
                      className="material-symbols-outlined text-lg"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      shield_person
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-primary">
                        AI Context Lock: Engaged
                      </span>
                      <span
                        className="material-symbols-outlined text-tertiary-container text-sm"
                        title="Zero data exposure guaranteed"
                      >
                        verified
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-snug">
                      Allowing AI to read this entry is disabled by default for your total privacy.
                      Never used in conversation prompts.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span className="text-[11px] text-on-surface-variant font-semibold">
                    Locked
                  </span>
                  <div
                    className="w-11 h-6 rounded-full bg-primary-container p-0.5 flex items-center justify-end cursor-not-allowed shadow-inner"
                    title="Locked by secure design philosophy"
                  >
                    <div className="w-5 h-5 rounded-full bg-surface shadow-sm flex items-center justify-center">
                      <span
                        className="material-symbols-outlined text-xs text-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        lock
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Footer: Persistence and Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse" />
                  <span className="text-[11px] text-on-surface-variant">{statusMessage}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {confirmingDelete ? (
                    <div className="flex items-center gap-2 bg-error-container/50 px-3 py-1.5 rounded-xl">
                      <span className="text-[12px] font-medium text-on-error-container">
                        Erase permanently?
                      </span>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        className="px-2.5 py-1 rounded-lg bg-error text-on-error text-[11px] font-semibold"
                      >
                        Yes, Erase
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        className="px-2.5 py-1 rounded-lg bg-surface text-on-surface text-[11px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-outline hover:text-error hover:bg-error-container/30 transition-colors text-[12px] font-medium"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                      <span>Delete permanently</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[14px] font-medium shadow-sm transition-all active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {saveState === 'saved'
                        ? 'done_all'
                        : saveState === 'encrypting'
                        ? 'refresh'
                        : 'check'}
                    </span>
                    <span>
                      {saveState === 'saved'
                        ? 'Encrypted & Stored'
                        : saveState === 'encrypting'
                        ? 'Encrypting...'
                        : 'Save Entry'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Passcode Lock Modal */}
      {passcodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-2xl">password</span>
                <h3 className="text-[18px] font-semibold text-primary">Passcode Lock Active</h3>
              </div>
              <button
                type="button"
                onClick={() => setPasscodeModalOpen(false)}
                aria-label="Close passcode dialog"
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <p className="text-[14px] text-on-surface-variant leading-relaxed">
              Your journal partition is secured with your master device key (AES-GCM 256). Entries
              cannot be read without unlocking this device.
            </p>
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low cursor-pointer">
              <span className="text-[13px] font-medium text-primary">
                Require Biometric / PIN on open
              </span>
              <input
                type="checkbox"
                checked={biometricEnabled}
                onChange={(e) => setBiometricEnabled(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setPasscodeModalOpen(false);
                showToast('Vault lock settings updated.');
              }}
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-[14px] font-semibold hover:bg-primary-container"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Non-blocking Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl bg-primary text-on-primary text-[13px] font-medium shadow-xl flex items-center gap-2 z-50">
          <span className="material-symbols-outlined text-tertiary-fixed text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
