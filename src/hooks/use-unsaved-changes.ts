import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";

export interface UseUnsavedChangesOptions {
  isDirty?: boolean;
  onSave?: () => Promise<boolean | void> | boolean | void;
  onDiscard?: () => void;
}

export function useUnsavedChanges({
  isDirty: externalIsDirty,
  onSave,
  onDiscard,
}: UseUnsavedChangesOptions = {}) {
  const [internalIsDirty, setInternalIsDirty] = useState(false);
  const isDirtyRef = useRef(false);

  if (externalIsDirty !== undefined) {
    isDirtyRef.current = externalIsDirty;
  }

  const isDirty = externalIsDirty !== undefined ? externalIsDirty : internalIsDirty;

  const [modalOpen, setModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // Synchronous clean-state reset
  const markClean = () => {
    isDirtyRef.current = false;
    setInternalIsDirty(false);
    if (blocker.status === "blocked") {
      blocker.reset();
    }
  };

  const setIsDirty = (dirty: boolean) => {
    isDirtyRef.current = dirty;
    setInternalIsDirty(dirty);
  };

  // TanStack Router Blocker for internal navigation & beforeunload for tab close/reload
  const blocker = useBlocker({
    shouldBlockFn: () => isDirtyRef.current,
    enableBeforeUnload: () => isDirtyRef.current,
    withResolver: true,
  });

  // Whenever router blocker intercepts a navigation, open the Unsaved Changes Modal
  useEffect(() => {
    if (blocker.status === "blocked") {
      setModalOpen(true);
    }
  }, [blocker.status]);

  // Handler for explicit Cancel/Back buttons in forms
  const handleCancelNavigation = (fallbackNavigate: () => void) => {
    if (!isDirtyRef.current) {
      fallbackNavigate();
      return;
    }
    pendingActionRef.current = fallbackNavigate;
    setModalOpen(true);
  };

  // Modal Action 1: Cancel -> Stay on page, reset blocker
  const handleModalCancel = () => {
    setModalOpen(false);
    pendingActionRef.current = null;
    if (blocker.status === "blocked") {
      blocker.reset();
    }
  };

  // Modal Action 2: Discard -> Proceed with navigation without saving
  const handleModalDiscard = () => {
    markClean();
    setModalOpen(false);
    if (onDiscard) {
      onDiscard();
    }

    const nextAction = pendingActionRef.current;
    pendingActionRef.current = null;

    if (blocker.status === "blocked") {
      blocker.proceed();
    } else if (nextAction) {
      nextAction();
    }
  };

  // Modal Action 3: Save Changes -> Persist data, then proceed with navigation
  const handleModalSave = async () => {
    if (onSave) {
      try {
        setIsSaving(true);
        const res = await onSave();
        if (res === false) {
          setIsSaving(false);
          return;
        }
      } catch {
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    markClean();
    setModalOpen(false);
    const nextAction = pendingActionRef.current;
    pendingActionRef.current = null;

    if (blocker.status === "blocked") {
      blocker.proceed();
    } else if (nextAction) {
      nextAction();
    }
  };

  return {
    isDirty,
    setIsDirty,
    markClean,
    modalOpen,
    setModalOpen,
    showModal: modalOpen,
    isSaving,
    setIsSaving,
    handleCancelNavigation,
    requestNavigation: handleCancelNavigation,
    handleModalCancel,
    onModalCancel: handleModalCancel,
    handleModalDiscard,
    onModalDiscard: handleModalDiscard,
    handleModalSave,
    onModalSave: handleModalSave,
  };
}
