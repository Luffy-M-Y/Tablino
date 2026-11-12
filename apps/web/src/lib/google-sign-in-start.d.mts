export type StartGoogleSignInResult =
  | { ok: true; action: string; ticket: string }
  | { ok: false; message: string };

export type StartGoogleSignInDeps = {
  getUniversityId: () => Promise<string>;
  createTicket: (universityId: string) => Promise<string>;
  getCentralHost: () => string | undefined;
  secure: boolean;
};

export function runStartGoogleSignIn(
  deps: StartGoogleSignInDeps,
): Promise<StartGoogleSignInResult>;
