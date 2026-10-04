import type { ReactNode } from "react";
import { DropdownMenu as Menu } from "radix-ui";
export function ViewerMenu({
  label,
  children,
  trigger,
}: {
  label: string;
  children: ReactNode;
  trigger: ReactNode;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger className="review-pill" aria-label={label}>
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="review-menu"
          side="top"
          align="center"
          sideOffset={12}
          collisionPadding={12}
          aria-label={label}
        >
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
export function ViewerMenuItem({
  children,
  onSelect,
  selected = false,
  disabled = false,
}: {
  children: ReactNode;
  onSelect: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Menu.Item
      className="review-menu-item"
      onSelect={onSelect}
      disabled={disabled}
      data-selected={selected}
    >
      {children}
    </Menu.Item>
  );
}
