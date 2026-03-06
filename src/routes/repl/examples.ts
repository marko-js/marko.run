export interface Example {
  name: string;
  source: string;
}

export const examples: Example[] = [
  {
    name: "Basic",
    source: `foo/
  +page.marko
  +middleware.ts
  +layout.marko
  bar/
    +middleware.ts
    +page.marko
    +layout.marko
+layout.marko`,
  },
  {
    name: "Catch-all",
    source: `+page.marko
+layout.marko
$$rest/
  +page.marko`,
  },
  {
    name: "Dynamic Params",
    source: `users/
  +page.marko
  $userId/
    +page.marko
    +layout.marko
    posts/
      +page.marko
      $postId/
        +page.marko
+layout.marko`,
  },
  {
    name: "Pathless Layout",
    source: `+layout.marko
_auth/
  +layout.marko
  login/
    +page.marko
  register/
    +page.marko
dashboard/
  +page.marko
  +middleware.ts`,
  },
  {
    name: "Middleware",
    source: `+layout.marko
+middleware.ts
api/
  +middleware.ts
  users/
    +handler.ts
  posts/
    +handler.ts
admin/
  +middleware.ts
  +page.marko
  +layout.marko`,
  },
];
