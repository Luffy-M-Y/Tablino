"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  getAdminMenuItems,
  shouldShowAdminHeaderNavigation,
  type AdminMenuEntry,
} from "@/lib/admin-menu.mjs";
import { signOutToLogin } from "@/components/sign-out-button";
import { getAdminSidebarPinPolicy } from "@/lib/admin-sidebar-pinning.mjs";
import AdminSearchBox from "@/components/admin-search-box";
import {
  BookOpen,
  ClipboardList,
  DollarSign,
  FilePen,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Pin,
  PinOff,
  ScanLine,
  Upload,
  User,
  UserCheck,
  UserPlus,
} from "lucide-react";

type MenuIconName = keyof typeof MENU_ICONS;

function hasMenuIcon(item: AdminMenuEntry): item is AdminMenuEntry & { icon: MenuIconName } {
  return "icon" in item
    && typeof item.icon === "string"
    && Object.hasOwn(MENU_ICONS, item.icon);
}

const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring-on-band)]";
const headerFocusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const SIDEBAR_PIN_STORAGE_KEY = "tablino-admin-sidebar-pinned";

const MENU_ICONS = {
  LayoutDashboard,
  UserCheck,
  UserPlus,
  Layers,
  ScanLine,
  Upload,
  FilePen,
  BookOpen,
  ClipboardList,
  KeyRound,
  DollarSign,
  ImageIcon,
};

const HEADER_SHORTCUTS = [
  { href: "/upload", label: "Uploader", Icon: Upload },
  { href: "/scan", label: "Scanner", Icon: ScanLine },
] as const;

type AdminProfile = {
  email: string | null;
  name: string | null;
  roleLabel: string;
  initial: string;
  role?: string;
  universityName?: string | null;
  universityAcronym?: string | null;
  universityLogoUrl?: string | null;
};

export function AdminShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: AdminProfile;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHoverOpen, setIsSidebarHoverOpen] = useState(false);
  const [isSidebarFocusWithin, setIsSidebarFocusWithin] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const sidebarHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountPanelRef = useRef<HTMLDivElement | null>(null);
  const menuItems = getAdminMenuItems(profile.role);
  const showHeaderNavigation = shouldShowAdminHeaderNavigation(profile.role);
  const pinPolicy = getAdminSidebarPinPolicy(profile.role);
  const isDesktopMenuExpanded = isSidebarPinned || isSidebarHoverOpen || isSidebarFocusWithin;
  const name = profile.name?.trim() || null;
  const email = profile.email?.trim() || null;
  const accountLabel = name ?? email;
  const universityAcronym = profile.role === "university_admin"
    ? profile.universityAcronym?.trim().toUpperCase() || null
    : null;
  const accessibleUniversityName = profile.role === "university_admin"
    ? profile.universityName?.trim() || universityAcronym
    : null;

  useEffect(function () {
    if (!pinPolicy.loadStoredValue) {
      setIsSidebarPinned(false);
      return;
    }

    try {
      setIsSidebarPinned(window.localStorage.getItem(SIDEBAR_PIN_STORAGE_KEY) === "true");
    } catch {
      console.warn("Le choix d’épinglage du menu ne peut pas être lu depuis le stockage local.");
    }

    return function () {
      if (sidebarHoverTimerRef.current !== null) {
        clearTimeout(sidebarHoverTimerRef.current);
      }
    };
  }, [pinPolicy.loadStoredValue]);

  useEffect(function () {
    if (!isAccountMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target === null) return;
      if (
        accountPanelRef.current?.contains(target)
        || accountButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsAccountMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
        accountButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return function () {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  function handleSidebarPointerEnter(event: React.PointerEvent<HTMLElement>) {
    if (
      event.pointerType === "touch"
      || isSidebarPinned
      || !window.matchMedia("(min-width: 768px)").matches
    ) return;
    if (sidebarHoverTimerRef.current !== null) {
      clearTimeout(sidebarHoverTimerRef.current);
    }
    sidebarHoverTimerRef.current = setTimeout(() => {
      setIsSidebarHoverOpen(true);
      sidebarHoverTimerRef.current = null;
    }, 120);
  }

  function handleSidebarPointerLeave() {
    if (sidebarHoverTimerRef.current !== null) {
      clearTimeout(sidebarHoverTimerRef.current);
      sidebarHoverTimerRef.current = null;
    }
    setIsSidebarHoverOpen(false);
  }

  function handleSidebarPinToggle() {
    if (!pinPolicy.showControl) return;
    const nextPinned = !isSidebarPinned;
    setIsSidebarPinned(nextPinned);
    try {
      window.localStorage.setItem(SIDEBAR_PIN_STORAGE_KEY, String(nextPinned));
    } catch {
      console.warn("Le choix d’épinglage du menu ne peut pas être mémorisé dans le stockage local.");
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--admin-page-background)] text-[color:var(--color-text)]">
      <header className={`sticky top-0 z-40 justify-between bg-[color:var(--color-admin-header)] text-white shadow-[var(--shadow-subtle)] ${showHeaderNavigation
        ? "flex min-h-16 flex-wrap items-center gap-y-2 px-4 py-2 sm:px-6"
        : "flex h-16 items-center px-4 sm:px-6"}`}>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={`flex items-center gap-2 rounded-[var(--radius-rounded)] text-lg font-bold text-white ${headerFocusStyle}`}
          >
            <Image src="/icons/icon-192.png" alt="" width={32} height={32} priority unoptimized className="rounded-lg ring-1 ring-white/20" />
            Tablino
          </Link>
          <button
            type="button"
            aria-controls="admin-sidebar"
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((open) => !open)}
            className={`rounded-[var(--radius-rounded)] border border-white/40 px-3 py-2 md:hidden ${headerFocusStyle}`}
          >
            {isSidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {profile.role !== "super_admin_lector" && <AdminSearchBox />}
          {profile.role === "university_admin" && (
            <nav aria-label="Raccourcis" className="hidden items-center gap-2 sm:flex">
              {HEADER_SHORTCUTS.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`flex h-10 items-center gap-2 rounded-[var(--radius-rounded)] border border-white/25 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10 motion-reduce:transition-none ${headerFocusStyle}`}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>
        {accountLabel === null ? (
          <button
            type="button"
            onClick={() => { void signOutToLogin(); }}
            className={"rounded-[var(--radius-rounded)] px-3 py-2 text-sm font-medium text-[color:var(--color-on-band)] hover:bg-white/10 " + headerFocusStyle}
          >
            Déconnexion
          </button>
        ) : (
          <div className="relative">
            <button
              ref={accountButtonRef}
              type="button"
              aria-label={`Compte de ${accountLabel}${accessibleUniversityName ? `, ${accessibleUniversityName}` : ""}`}
              title={profile.role === "university_admin" ? profile.universityName?.trim() || undefined : undefined}
              aria-expanded={isAccountMenuOpen}
              aria-controls="admin-account-panel"
              onClick={() => setIsAccountMenuOpen((open) => !open)}
              className={`flex items-center justify-center rounded-full bg-[color:var(--color-primary)] text-sm font-semibold text-[color:var(--color-on-band)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring-on-band)] ${profile.role === "university_admin" ? "h-12 max-w-[min(38rem,65vw)] gap-2 px-1.5" : "h-10 w-10"}`}
            >
              {profile.role === "university_admin" ? (
                profile.universityLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image servie par l'hôte admin, déjà en 256 px
                  <img
                    src={profile.universityLogoUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-full border border-white/40 bg-white object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40">
                    <User size={20} aria-hidden="true" />
                  </span>
                )
              ) : (
                profile.initial
              )}
              {profile.role === "university_admin" ? (
                <>
                  {profile.universityName?.trim() ? (
                    <span className="hidden max-w-[22rem] line-clamp-2 whitespace-normal px-1 text-left text-sm font-medium leading-tight lg:block">
                      {profile.universityName.trim()}
                    </span>
                  ) : null}
                  {universityAcronym ? (
                    <span className="max-w-20 shrink-0 truncate rounded-full bg-white/15 px-2 py-1 text-xs font-semibold tracking-wide">
                      {universityAcronym}
                    </span>
                  ) : null}
                </>
              ) : null}
            </button>
            {isAccountMenuOpen ? (
              <div
                id="admin-account-panel"
                ref={accountPanelRef}
                className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-[color:var(--color-text)] shadow-[var(--shadow-subtle)]"
              >
                <div className="space-y-1">
                  {name !== null ? (
                    <p className="truncate text-sm font-semibold">{name}</p>
                  ) : null}
                  {email !== null ? (
                    <p className="truncate text-sm text-[color:var(--color-muted-foreground)]">{email}</p>
                  ) : null}
                  <p className="truncate text-sm text-[color:var(--color-muted-foreground)]">{profile.roleLabel}</p>
                </div>
                <div className="mt-4 space-y-1 border-t border-[color:var(--color-border)] pt-3">
                  {profile.role === "university_admin" ? (
                    <Link
                      href="/universite"
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-rounded)] px-3 py-2 text-sm font-medium text-[color:var(--color-text)] hover:bg-[color:var(--color-page-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
                    >
                      <ImageIcon size={16} aria-hidden="true" />
                      <span>Logo de l&apos;universit&eacute;</span>
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      void signOutToLogin();
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-rounded)] px-3 py-2 text-sm font-medium text-[color:var(--color-text)] hover:bg-[color:var(--color-page-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
                  >
                    <LogOut size={16} aria-hidden="true" />
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
        {showHeaderNavigation ? (
          <nav
            aria-label="Navigation super-administrateur"
            className="order-last flex w-full items-center gap-4 overflow-x-auto border-t border-white/20 pt-2 text-sm sm:gap-5"
          >
            <span className="shrink-0 font-semibold">{profile.roleLabel}</span>
            <ul className="flex shrink-0 items-center gap-2">
              {menuItems.map((item) => {
                if (item.disabled || !("href" in item)) return null;
                const isActive = pathname === item.href
                  || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`block whitespace-nowrap rounded-[var(--radius-rounded)] px-3 py-2 ${headerFocusStyle} ${isActive ? "bg-white/20 font-semibold" : "hover:bg-white/10"}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </header>

      <div className={`flex ${showHeaderNavigation
        ? "min-h-[calc(100vh-7rem)]"
        : "min-h-[calc(100vh-4rem)]"}`}>
        <div
          className={`hidden shrink-0 md:block md:transition-[width] md:duration-200 md:motion-reduce:transition-none ${isDesktopMenuExpanded ? "md:w-52" : "md:w-16"}`}
          aria-hidden="true"
        />
        <aside
          id="admin-sidebar"
          onPointerEnter={handleSidebarPointerEnter}
          onPointerLeave={handleSidebarPointerLeave}
          onFocusCapture={() => setIsSidebarFocusWithin(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsSidebarFocusWithin(false);
            }
          }}
          className={`${isSidebarOpen ? "fixed" : "hidden"} group/sidebar left-0 z-30 flex w-72 flex-col overflow-x-hidden border-r border-[color:var(--color-band)] bg-[color:var(--color-band)] p-5 shadow-[var(--shadow-subtle)] ${showHeaderNavigation
            ? "top-28 bottom-0 md:inset-y-28 md:h-[calc(100vh-7rem)]"
            : "inset-y-16 md:h-[calc(100vh-4rem)]"} md:fixed md:left-0 md:z-50 md:block md:overflow-y-auto md:p-2 md:transition-[width] md:duration-200 md:motion-reduce:transition-none ${isDesktopMenuExpanded ? "md:w-52" : "md:w-16"}`}
        >
          <nav aria-label="Navigation principale">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                if (!hasMenuIcon(item)) {
                  throw new Error(`Missing Lucide icon for admin menu item "${item.id}"`);
                }
                const Icon = MENU_ICONS[item.icon];
                if (item.disabled) {
                  return (
                    <li key={item.id}>
                      <span
                        aria-disabled="true"
                        className="relative flex h-10 cursor-not-allowed items-center gap-3 overflow-hidden rounded-[var(--radius-rounded)] px-3 py-2 text-sm text-[color:var(--color-on-band-muted)] md:px-1"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center">
                          <Icon size={20} aria-hidden="true" />
                        </span>
                        <span className={`absolute left-14 whitespace-nowrap text-sm md:transition-opacity md:duration-200 motion-reduce:transition-none ${isDesktopMenuExpanded ? "md:opacity-100" : "md:opacity-0"}`}>
                          {item.label}
                          <span className="ml-2 text-xs">{item.availabilityLabel}</span>
                        </span>
                      </span>
                    </li>
                  );
                }

                const isActive = pathname === item.href
                  || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`relative flex h-10 items-center gap-3 overflow-hidden rounded-[var(--radius-rounded)] px-3 py-2 text-sm text-[color:var(--color-on-band)] md:px-1 ${focusStyle} ${isActive
                        ? "bg-[color:var(--admin-menu-active-background)] font-semibold"
                        : "hover:bg-white/10"}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-2 left-0 top-2 w-0.5 rounded-full ${isActive ? "bg-[color:var(--admin-menu-indicator)]" : "bg-transparent"}`}
                      />
                      <span className="flex size-10 shrink-0 items-center justify-center">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className={`absolute left-14 whitespace-nowrap text-sm md:transition-opacity md:duration-200 motion-reduce:transition-none ${isDesktopMenuExpanded ? "md:opacity-100" : "md:opacity-0"}`}>
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {pinPolicy.showControl && <button
            type="button"
            aria-label={isSidebarPinned ? "Désépingler le menu" : "Épingler le menu"}
            aria-pressed={isSidebarPinned}
            onClick={handleSidebarPinToggle}
            className={`mt-4 hidden h-10 items-center gap-3 rounded-[var(--radius-rounded)] px-3 text-sm text-[color:var(--color-on-band)] hover:bg-white/10 md:px-2 ${focusStyle} ${isDesktopMenuExpanded ? "md:flex" : "md:hidden"}`}
          >
            {isSidebarPinned ? (
              <PinOff size={20} aria-hidden="true" />
            ) : (
              <Pin size={20} aria-hidden="true" />
            )}
            <span className="whitespace-nowrap">
              {isSidebarPinned ? "Désépingler le menu" : "Épingler le menu"}
            </span>
          </button>}
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
