import { useState, useEffect } from 'react';
import { fetchSkillCategories } from '~/lib/categories';

// These groups are their own verticals — shown separately from general staffing
const VERTICAL_GROUPS = ['GigDekho Projects', 'Artist Booking'];

/**
 * Grouped skill selector driven by the skill_categories table.
 * Top-level category → specific skills; Projects & Artist Booking
 * rendered as separate verticals.
 */
export default function SkillSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (skills: string[]) => void;
}) {
  const [categories, setCategories] = useState<any[]>([]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    fetchSkillCategories().then((data) => {
      setCategories(data);
      // Open the first staffing group by default so the panel isn't blank
      const firstGroup = data.find((c: any) => !VERTICAL_GROUPS.includes(c.category_group))?.category_group;
      setOpenGroup(firstGroup ?? null);
    });
  }, []);

  const toggle = (skill: string) => {
    onChange(selected.includes(skill) ? selected.filter(s => s !== skill) : [...selected, skill]);
  };

  const groups = categories.reduce((acc: Record<string, any[]>, cat) => {
    const g = cat.category_group || 'Other';
    (acc[g] ??= []).push(cat);
    return acc;
  }, {});

  const staffingGroups = Object.keys(groups).filter(g => !VERTICAL_GROUPS.includes(g));
  const verticalGroups = Object.keys(groups).filter(g => VERTICAL_GROUPS.includes(g));

  const renderGroup = (group: string) => {
    const isOpen = openGroup === group;
    const selectedInGroup = groups[group].filter((c: any) => selected.includes(c.name)).length;
    return (
      <div key={group} className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenGroup(isOpen ? null : group)}
          aria-expanded={isOpen}
          className="w-full flex justify-between items-center px-4 py-3 text-left"
        >
          <span className="text-sm font-bold text-white">
            {group}
            {selectedInGroup > 0 && (
              <span className="ml-2 text-[10px] font-black text-[#F4511E] bg-[#F4511E]/10 border border-[#F4511E]/20 px-2 py-0.5 rounded-full">
                {selectedInGroup}
              </span>
            )}
          </span>
          <span className={`text-white/40 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 flex flex-wrap gap-2 animate-in fade-in duration-150">
            {groups[group].map((cat: any) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggle(cat.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border btn-tap transition-colors ${
                  selected.includes(cat.name)
                    ? 'bg-[#F4511E] border-[#F4511E] text-white'
                    : 'bg-transparent border-white/15 text-white/60 hover:border-[#F4511E] hover:text-[#F4511E]'
                }`}
                style={{ minHeight: '34px' }}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {staffingGroups.map(renderGroup)}
      {verticalGroups.length > 0 && (
        <>
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest pt-3 pb-1">
            Specialized Verticals
          </p>
          {verticalGroups.map(renderGroup)}
        </>
      )}
    </div>
  );
}
