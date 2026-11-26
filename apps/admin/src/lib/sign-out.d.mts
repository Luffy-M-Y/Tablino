export function runSignOutToLogin(deps: {
  signOut: (options: { redirect: false }) => Promise<unknown>;
  assign: (url: string) => void;
}): Promise<boolean>;
