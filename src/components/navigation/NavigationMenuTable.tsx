import {
  GripVertical,
  Home,
  BookOpen,
  Award,
  Box,
  FileText,
  Info,
  Mail,
  Zap,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { type NavigationMenuItem } from "@/lib/navigation-data";

interface NavigationMenuTableProps {
  items: NavigationMenuItem[];
  selectedId: string;
  onSelectItem: (item: NavigationMenuItem) => void;
  onAddItem: () => void;
  onDeleteItem: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
}

const ICON_MAP: Record<string, any> = {
  Home,
  BookOpen,
  Award,
  Box,
  FileText,
  Info,
  Mail,
  Zap,
};

export function NavigationMenuTable({
  items,
  selectedId,
  onSelectItem,
  onAddItem,
  onDeleteItem,
  onMoveUp,
  onMoveDown,
}: NavigationMenuTableProps) {
  return (
    <div className="flex flex-col rounded-xl border border-brand/20 bg-panel/85 shadow-lg overflow-hidden">
      {/* Table Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand/15 p-4">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Navigation Menu</h3>
          <p className="text-[12px] text-muted-foreground">Manage the items in your main navigation bar.</p>
        </div>

        <button
          type="button"
          onClick={onAddItem}
          className="flex items-center gap-1.5 rounded-lg border border-brand-bright/70 bg-gradient-to-r from-brand to-brand-bright px-3.5 py-1.5 text-[12px] font-bold text-background shadow-[0_0_12px_rgba(0,255,170,0.3)] transition hover:brightness-110"
        >
          <Plus className="size-3.5" />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-brand/15 bg-background/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-16 px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Label</th>
              <th className="px-3 py-2.5">Link / Page</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand/10">
            {items.map((item, idx) => {
              const Icon = (item.iconName && ICON_MAP[item.iconName]) || Home;
              const isSelected = item.id === selectedId;

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={`transition cursor-pointer ${
                    isSelected ? "bg-brand/15 border-l-2 border-l-brand-bright" : "hover:bg-brand/10"
                  }`}
                >
                  {/* Handle & Order & Reorder Arrows */}
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 text-muted-foreground/60">
                      <div className="flex flex-col items-center">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => onMoveUp?.(item.id)}
                          aria-label={`Move ${item.label} Up`}
                          className="p-0.5 text-muted-foreground hover:text-brand-bright disabled:opacity-20 disabled:hover:text-muted-foreground transition"
                        >
                          <ChevronUp className="size-2.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => onMoveDown?.(item.id)}
                          aria-label={`Move ${item.label} Down`}
                          className="p-0.5 text-muted-foreground hover:text-brand-bright disabled:opacity-20 disabled:hover:text-muted-foreground transition"
                        >
                          <ChevronDown className="size-2.5" />
                        </button>
                      </div>
                      <span className="text-[11px] font-bold text-foreground/80">{idx + 1}</span>
                    </div>
                  </td>

                  {/* Label with icon */}
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 text-brand-bright" />
                      <span>{item.label}</span>
                    </div>
                  </td>

                  {/* Link / URL */}
                  <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground">
                    {item.link}
                  </td>

                  {/* Type */}
                  <td className="px-3 py-2.5">
                    {item.type === "Button" ? (
                      <span className="inline-block rounded border border-purple-500/40 bg-purple-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-purple-400">
                        Button
                      </span>
                    ) : (
                      <span className="inline-block rounded border border-brand/30 bg-background/60 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                        {item.type}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand-bright">
                      <span className="size-1.5 rounded-full bg-brand-bright" />
                      {item.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectItem(item)}
                        aria-label="Edit"
                        className="flex size-7 items-center justify-center rounded-md border border-brand/20 text-muted-foreground hover:border-brand-bright/50 hover:text-brand-bright"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        aria-label="Delete"
                        className="flex size-7 items-center justify-center rounded-md border border-red-500/20 text-red-400 hover:bg-red-950/30 hover:border-red-500/50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
