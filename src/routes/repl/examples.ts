export default [
  {
    name: "Basic",
    source: `foo/
  bar/
    +layout.marko
    +middleware.ts
    +page.marko
  +layout.marko
  +middleware.ts
  +page.marko
+layout.marko
`,
  },
  {
    name: "Dynamic",
    source: `users/
  $userId/
    posts/
      $postId/
        +page.marko
      +page.marko
    +layout.marko
    +page.marko
  +page.marko
+layout.marko
`,
  },
  {
    name: "Catch-all",
    source: `$$rest/
  +page.marko
+layout.marko
+page.marko
`,
  },
  {
    name: "Grouping",
    source: `_private/
  dashboard/
    +page.marko
  settings/
    +page.marko
  +layout.marko
  +middleware.ts
login/
  +page.marko
register/
  +page.marko
+layout.marko
+page.marko
`,
  },
  {
    name: "API",
    source: `api/
  posts/
    $postId/
      +handler.ts
    +handler.ts
  users/
    $userId/
      +handler.ts
    +handler.ts
  +middleware.ts
+layout.marko
+middleware.ts
+page.marko
`,
  },
  {
    name: "Narrowing",
    source: `users/
  $userId/
    &me/
      +page.marko
    +layout.marko
    +page.marko
+layout.marko
​`,
  },
];
