"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "./button";
import { useRef } from "react";
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content
          className="drawer-content"
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
        >
          <div className="drawer-top">
            <span className="eyebrow">PERSONA LAB / FIELD NOTES</span>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close panel">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Title className="drawer-title">{title}</Dialog.Title>
          <Dialog.Description className="muted drawer-description">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
