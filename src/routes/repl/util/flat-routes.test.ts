import { describe, it, expect } from "vitest";
import { parseFlatRoute } from "./flat-routes";

describe("parseFlatRoute", () => {
  describe("basic directory paths", () => {
    it("should parse foo.bar as /foo/bar", () => {
      const result = parseFlatRoute("foo.bar");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo/bar");
    });

    it("should error on trailing dot", () => {
      const result = parseFlatRoute("foo.");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Expected segment character before end",
      );
    });

    it("should error on double dots", () => {
      const result = parseFlatRoute("foo..bar");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Unexpected '.'");
    });

    it("should error on leading dot", () => {
      const result = parseFlatRoute(".foo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Unexpected '.'");
    });
  });

  describe("alternates", () => {
    it("should parse foo,bar as /foo and /bar", () => {
      const result = parseFlatRoute("foo,bar");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/bar");
    });

    it("should parse foo, as /foo and /", () => {
      const result = parseFlatRoute("foo,");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/");
    });

    it("should parse ,foo as / and /foo", () => {
      const result = parseFlatRoute(",foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/");
      expect(result.paths[1].key).toBe("/foo");
    });

    it("should error on ,foo, (multiple matches to /)", () => {
      const result = parseFlatRoute(",foo,");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Path '/' duplicates '/'");
    });

    it("should error on single comma (multiple matches to /)", () => {
      const result = parseFlatRoute(",");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Path '/' duplicates '/'");
    });

    it("should error on duplicate routes", () => {
      const result = parseFlatRoute("foo,foo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Path '/foo' duplicates '/foo'");
    });

    it("should parse foo.bar, as /foo/bar and /", () => {
      const result = parseFlatRoute("foo.bar,");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo/bar");
      expect(result.paths[1].key).toBe("/");
    });

    it("should error on foo.,bar", () => {
      const result = parseFlatRoute("foo.,bar");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Unexpected ','");
    });
  });

  describe("dynamic segments", () => {
    it("should parse $ as /$", () => {
      const result = parseFlatRoute("$");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/$");
    });

    it("should parse $name as /$", () => {
      const result = parseFlatRoute("$name");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/$");
      expect(result.paths[0].segments[0].dynamic).toBe("$");
      expect(result.paths[0].segments[0].name).toBe("name");
    });

    it("should parse foo.$name as /foo/$", () => {
      const result = parseFlatRoute("foo.$name");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo/$");
    });

    it("should parse $name.foo as /$/foo", () => {
      const result = parseFlatRoute("$name.foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/$/foo");
    });

    it("should parse name$ as /name$", () => {
      const result = parseFlatRoute("name$");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/name$");
    });

    it("should parse n$ame as /n$ame", () => {
      const result = parseFlatRoute("n$ame");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/n$ame");
    });
  });

  describe("wildcard segments", () => {
    it("should parse $$ as /$$", () => {
      const result = parseFlatRoute("$$");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/$$");
    });

    it("should parse $$rest as /$$", () => {
      const result = parseFlatRoute("$$rest");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/$$");
      expect(result.paths[0].segments[0].dynamic).toBe("$$");
      expect(result.paths[0].segments[0].name).toBe("rest");
    });

    it("should parse foo.$$rest as /foo/$$", () => {
      const result = parseFlatRoute("foo.$$rest");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo/$$");
    });

    it("should error on foo.$$rest.bar", () => {
      const result = parseFlatRoute("foo.$$rest.bar");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Non-narrowing segment 'bar' may not followed previous catch-all segment '$$rest'",
      );
    });

    it("should parse rest$ as /rest$", () => {
      const result = parseFlatRoute("rest$");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/rest$");
    });

    it("should parse f$oo as /f$oo", () => {
      const result = parseFlatRoute("f$oo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/f$oo");
    });
  });

  describe("pathless segments", () => {
    it("should parse _foo as /", () => {
      const result = parseFlatRoute("_foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/");
      expect(result.paths[0].segments[0].prefix).toBe("_");
    });

    it("should parse foo._bar as /foo", () => {
      const result = parseFlatRoute("foo._bar");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo");
    });

    it("should parse foo._bar.baz as /foo/baz", () => {
      const result = parseFlatRoute("foo._bar.baz");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo/baz");
    });

    it("should parse _ as /", () => {
      const result = parseFlatRoute("_");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/");
    });

    it("should parse foo_ as /foo_", () => {
      const result = parseFlatRoute("foo_");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo_");
    });
  });

  describe("narrowing segments", () => {
    it("should parse $name.&foo as /foo", () => {
      const result = parseFlatRoute("$name.&foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo");
    });

    it("should parse $name.&foo.bar as /foo/bar", () => {
      const result = parseFlatRoute("$name.&foo.bar");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo/bar");
    });

    it("should parse foo.&foo as /foo", () => {
      const result = parseFlatRoute("foo.&foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo");
    });

    it("should error on bar.&foo (cannot narrow)", () => {
      const result = parseFlatRoute("bar.&foo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Static segment '&foo' does not narrow previous static segement 'bar'",
      );
    });

    it("should parse $name.(&foo,&bar,) as multiple paths", () => {
      const result = parseFlatRoute("$name.(&foo,&bar,)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(3);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/bar");
      expect(result.paths[2].key).toBe("/$");
    });

    it("should parse $$rest.&$name as /$", () => {
      const result = parseFlatRoute("$$rest.&$name");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/$");
    });

    it("should parse $$rest.(&$name,) as /$ and /$$", () => {
      const result = parseFlatRoute("$$rest.(&$name,)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/$");
      expect(result.paths[1].key).toBe("/$$");
    });

    it("should error on $$rest.&$$all", () => {
      const result = parseFlatRoute("$$rest.&$$all");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Catch-all segement '&$$all' may not narrow previous catch-all segment '$$rest'",
      );
    });

    it("should parse $$rest.&foo as /foo", () => {
      const result = parseFlatRoute("$$rest.&foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo");
    });
  });

  describe("sub-expression groups", () => {
    it("should parse foo.(,bar) as /foo and /foo/bar", () => {
      const result = parseFlatRoute("foo.(,bar)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/foo/bar");
    });

    it("should parse (foo,bar) as /foo and /bar", () => {
      const result = parseFlatRoute("(foo,bar)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/bar");
    });

    it("should parse (foo.bar) as /foo/bar", () => {
      const result = parseFlatRoute("(foo.bar)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo/bar");
    });

    it("should parse (foo) as /foo", () => {
      const result = parseFlatRoute("(foo)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo");
    });

    it("should parse (foo,).(bar,) as 4 paths", () => {
      const result = parseFlatRoute("(foo,).(bar,)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(4);
      expect(result.paths[0].key).toBe("/foo/bar");
      expect(result.paths[1].key).toBe("/foo");
      expect(result.paths[2].key).toBe("/bar");
      expect(result.paths[3].key).toBe("/");
    });

    it("should error on unclosed parenthesis", () => {
      const result = parseFlatRoute("(foo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Expected ')' before end");
    });

    it("should error on unmatched closing parenthesis", () => {
      const result = parseFlatRoute("foo)");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Unexpected ')'");
    });

    it("should error on ().bar", () => {
      const result = parseFlatRoute("().bar");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Group cannot be empty");
    });

    it("should error on bar.()", () => {
      const result = parseFlatRoute("bar.()");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Group cannot be empty");
    });

    it("should error on foo.().bar", () => {
      const result = parseFlatRoute("foo.().bar");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Group cannot be empty");
    });

    it("should error on empty parens", () => {
      const result = parseFlatRoute("()");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Group cannot be empty");
    });

    it("should parse (foo,bar).&foo as /foo", () => {
      const result = parseFlatRoute("(foo,bar).&foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo");
    });
  });

  describe("escaped groups", () => {
    it("should parse `foo.bar` as /foo.bar", () => {
      const result = parseFlatRoute("`foo.bar`");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo.bar");
    });

    it("should parse foo`.`bar as /foo.bar", () => {
      const result = parseFlatRoute("foo`.`bar");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo.bar");
    });

    it("should error on unclosed backtick", () => {
      const result = parseFlatRoute("`foo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Expected '`' before end");
    });

    it("should error on unmatched closing backtick", () => {
      const result = parseFlatRoute("foo`");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Expected '`' before end");
    });
  });

  describe("empty and single-segment inputs", () => {
    it("should parse empty string as /", () => {
      const result = parseFlatRoute("");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/");
    });

    it("should parse single segment foo as /foo", () => {
      const result = parseFlatRoute("foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo");
    });

    it("should parse single character segment a as /a", () => {
      const result = parseFlatRoute("a");
      expect(result.errors).toEqual([]);
      expect(result.paths[0].key).toBe("/a");
    });
  });

  describe("deep paths", () => {
    it("should parse a.b.c.d as /a/b/c/d", () => {
      const result = parseFlatRoute("a.b.c.d");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/a/b/c/d");
      expect(result.paths[0].segments).toHaveLength(4);
    });

    it("should parse three alternates a,b,c", () => {
      const result = parseFlatRoute("a,b,c");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(3);
      expect(result.paths[0].key).toBe("/a");
      expect(result.paths[1].key).toBe("/b");
      expect(result.paths[2].key).toBe("/c");
    });

    it("should parse alternates with dots: a.b,c.d", () => {
      const result = parseFlatRoute("a.b,c.d");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/a/b");
      expect(result.paths[1].key).toBe("/c/d");
    });
  });

  describe("multiple dynamic and wildcard segments", () => {
    it("should parse $a.$b as /$/$", () => {
      const result = parseFlatRoute("$a.$b");
      expect(result.errors).toEqual([]);
      expect(result.paths[0].key).toBe("/$/$");
    });

    it("should parse foo.$a.bar.$b as /foo/$/bar/$", () => {
      const result = parseFlatRoute("foo.$a.bar.$b");
      expect(result.errors).toEqual([]);
      expect(result.paths[0].key).toBe("/foo/$/bar/$");
    });

    it("should parse alternate with dynamic: foo,$name", () => {
      const result = parseFlatRoute("foo,$name");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/$");
    });

    it("should parse alternate with wildcard: foo,$$rest", () => {
      const result = parseFlatRoute("foo,$$rest");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/$$");
    });
  });

  describe("consecutive pathless segments", () => {
    it("should parse _a._b.foo as /foo", () => {
      const result = parseFlatRoute("_a._b.foo");
      expect(result.errors).toEqual([]);
      expect(result.paths[0].key).toBe("/foo");
    });

    it("should parse foo._a._b as /foo", () => {
      const result = parseFlatRoute("foo._a._b");
      expect(result.errors).toEqual([]);
      expect(result.paths[0].key).toBe("/foo");
    });

    it("should parse _a._b._c as /", () => {
      const result = parseFlatRoute("_a._b._c");
      expect(result.errors).toEqual([]);
      expect(result.paths[0].key).toBe("/");
    });

    it("should parse _layout.foo.bar as /foo/bar", () => {
      const result = parseFlatRoute("_layout.foo.bar");
      expect(result.errors).toEqual([]);
      expect(result.paths[0].key).toBe("/foo/bar");
    });
  });

  describe("complex sub-expression groups", () => {
    it("should parse nested group: (foo.(bar,baz))", () => {
      const result = parseFlatRoute("(foo.(bar,baz))");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo/bar");
      expect(result.paths[1].key).toBe("/foo/baz");
    });

    it("should parse group followed by segment: (foo,bar).baz", () => {
      const result = parseFlatRoute("(foo,bar).baz");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo/baz");
      expect(result.paths[1].key).toBe("/bar/baz");
    });

    it("should parse group followed by group: (a,b).(c,d)", () => {
      const result = parseFlatRoute("(a,b).(c,d)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(4);
      expect(result.paths[0].key).toBe("/a/c");
      expect(result.paths[1].key).toBe("/a/d");
      expect(result.paths[2].key).toBe("/b/c");
      expect(result.paths[3].key).toBe("/b/d");
    });

    it("should parse segment.group.segment: a.(b,c).d", () => {
      const result = parseFlatRoute("a.(b,c).d");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/a/b/d");
      expect(result.paths[1].key).toBe("/a/c/d");
    });

    it("should parse triple group product: (a,b).(c,d).(e,f)", () => {
      const result = parseFlatRoute("(a,b).(c,d).(e,f)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(8);
      expect(result.paths.map((p) => p.key)).toEqual([
        "/a/c/e",
        "/a/c/f",
        "/a/d/e",
        "/a/d/f",
        "/b/c/e",
        "/b/c/f",
        "/b/d/e",
        "/b/d/f",
      ]);
    });

    it("should parse dynamic in group: ($name,foo)", () => {
      const result = parseFlatRoute("($name,foo)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/$");
      expect(result.paths[1].key).toBe("/foo");
    });

    it("should parse pathless in group: (_layout,foo)", () => {
      const result = parseFlatRoute("(_layout,foo)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/");
      expect(result.paths[1].key).toBe("/foo");
    });

    it("should error on nested unclosed group: (foo.(bar)", () => {
      const result = parseFlatRoute("(foo.(bar)");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Expected ')' before end");
    });

    it("should error on trailing dot inside group: (foo.)", () => {
      const result = parseFlatRoute("(foo.)");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Unexpected ')'");
    });

    it("should error on leading dot inside group: (.foo)", () => {
      const result = parseFlatRoute("(.foo)");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Unexpected '.'");
    });
  });

  describe("complex narrowing", () => {
    it("should parse (foo,bar,baz).&foo as /foo only", () => {
      const result = parseFlatRoute("(foo,bar,baz).&foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo");
    });

    it("should parse $name.&foo.baz as /foo/baz", () => {
      const result = parseFlatRoute("$name.&foo.baz");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo/baz");
    });

    it("should parse $$rest.&$name.foo as /$/foo", () => {
      const result = parseFlatRoute("$$rest.&$name.foo");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/$/foo");
    });

    it("should parse $$rest.&foo.bar as /foo/bar", () => {
      const result = parseFlatRoute("$$rest.&foo.bar");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo/bar");
    });
  });

  describe("escaped groups with special characters", () => {
    it("should escape comma in backticks: `foo,bar`", () => {
      const result = parseFlatRoute("`foo,bar`");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo,bar");
    });

    it("should escape parens in backticks: `foo(bar)`", () => {
      const result = parseFlatRoute("`foo(bar)`");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo(bar)");
    });

    it("should escape dollar in backticks: `$foo`", () => {
      const result = parseFlatRoute("`$foo`");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/$foo");
    });

    it("should parse multiple escaped groups in same segment: a`b`c`d`e", () => {
      const result = parseFlatRoute("a`b`c`d`e");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/abcde");
    });

    it("should parse escaped dot between segments: foo.`a.b`.bar", () => {
      const result = parseFlatRoute("foo.`a.b`.bar");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo/a.b/bar");
    });
  });

  describe("segment metadata", () => {
    it("should set correct raw on static segment", () => {
      const result = parseFlatRoute("foo");
      const seg = result.paths[0].segments[0];
      expect(seg.raw).toBe("foo");
      expect(seg.name).toBe("foo");
      expect(seg.prefix).toBe("");
      expect(seg.dynamic).toBe(false);
    });

    it("should set correct raw on dynamic segment", () => {
      const result = parseFlatRoute("$name");
      const seg = result.paths[0].segments[0];
      expect(seg.raw).toBe("$name");
      expect(seg.name).toBe("name");
      expect(seg.prefix).toBe("");
      expect(seg.dynamic).toBe("$");
      expect(seg.name).toBe("name");
    });

    it("should set correct raw on wildcard segment", () => {
      const result = parseFlatRoute("$$rest");
      const seg = result.paths[0].segments[0];
      expect(seg.raw).toBe("$$rest");
      expect(seg.name).toBe("rest");
      expect(seg.prefix).toBe("");
      expect(seg.dynamic).toBe("$$");
      expect(seg.name).toBe("rest");
    });

    it("should set correct prefix on pathless segment", () => {
      const result = parseFlatRoute("_layout");
      const seg = result.paths[0].segments[0];
      expect(seg.raw).toBe("_layout");
      expect(seg.name).toBe("layout");
      expect(seg.prefix).toBe("_");
    });

    it("should set correct prefix on narrowing segment", () => {
      const result = parseFlatRoute("$name.&foo");
      const seg = result.paths[0].segments[1];
      expect(seg.raw).toBe("&foo");
      expect(seg.name).toBe("foo");
      expect(seg.prefix).toBe("&");
    });

    it("should have correct segment count for multi-segment path", () => {
      const result = parseFlatRoute("foo._bar.baz");
      expect(result.paths[0].segments).toHaveLength(3);
      expect(result.paths[0].segments[0].name).toBe("foo");
      expect(result.paths[0].segments[1].prefix).toBe("_");
      expect(result.paths[0].segments[1].name).toBe("bar");
      expect(result.paths[0].segments[2].name).toBe("baz");
    });
  });

  describe("duplicate detection across complex expansions", () => {
    it("should detect duplicate from group expansion: (foo,foo)", () => {
      const result = parseFlatRoute("(foo,foo)");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Path '/foo' duplicates '/foo'");
    });

    it("should detect duplicate from cross product: (a,b).(c,c)", () => {
      const result = parseFlatRoute("(a,b).(c,c)");
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].message).toBe("Path '/c' duplicates '/c'");
    });

    it("should error on triple trailing commas: ,,", () => {
      const result = parseFlatRoute(",,");
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].message).toBe("Unexpected ','");
    });
  });

  describe("wildcard followed by non-narrowing in different contexts", () => {
    it("should error on $$rest.$name", () => {
      const result = parseFlatRoute("$$rest.$name");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Non-narrowing segment '$name' may not followed previous catch-all segment '$$rest'",
      );
    });

    it("should error on $$rest._layout", () => {
      const result = parseFlatRoute("$$rest._layout");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Non-narrowing segment '_layout' may not followed previous catch-all segment '$$rest'",
      );
    });

    it("should error on $$.foo", () => {
      const result = parseFlatRoute("$$.foo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Non-narrowing segment 'foo' may not followed previous catch-all segment '$$'",
      );
    });
  });

  describe("pathless with dynamic", () => {
    it("should parse $name._layout as /$", () => {
      const result = parseFlatRoute("$name._layout");
      expect(result.errors).toEqual([]);
      expect(result.paths[0].key).toBe("/$");
    });

    it("should parse _layout.$name as /$", () => {
      const result = parseFlatRoute("_layout.$name");
      expect(result.errors).toEqual([]);
      expect(result.paths[0].key).toBe("/$");
    });
  });

  describe("mixed features", () => {
    it("should parse foo.(bar,$name).baz", () => {
      const result = parseFlatRoute("foo.(bar,$name).baz");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo/bar/baz");
      expect(result.paths[1].key).toBe("/foo/$/baz");
    });

    it("should parse _layout.(foo,bar).(baz,)", () => {
      const result = parseFlatRoute("_layout.(foo,bar).(baz,)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(4);
      expect(result.paths[0].key).toBe("/foo/baz");
      expect(result.paths[1].key).toBe("/foo");
      expect(result.paths[2].key).toBe("/bar/baz");
      expect(result.paths[3].key).toBe("/bar");
    });

    it("should parse $type.($id,$$rest)", () => {
      const result = parseFlatRoute("$type.($id,$$rest)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/$/$");
      expect(result.paths[1].key).toBe("/$/$$");
    });

    it("should parse alternates with pathless: foo,_bar", () => {
      const result = parseFlatRoute("foo,_bar");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/");
    });

    it("should parse (foo,bar).(&foo,&bar)", () => {
      const result = parseFlatRoute("(foo,bar).(&foo,&bar)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/bar");
    });

    it("should error on ($a,).($b,) due to ambiguous routes", () => {
      const result = parseFlatRoute("($a,).($b,)");
      // Expands to: /$a/$b, /$a, /$b, /
      // /$a and /$b are ambiguous (both are single dynamic segments)
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toBe("Path '/$b' duplicates '/$a'");
    });
  });

  describe("narrowing edge cases", () => {
    it("should error on &foo as first segment (no preceding segment)", () => {
      const result = parseFlatRoute("&foo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Narrowing segment '&foo' may not narrow root segment '/'",
      );
    });

    it("should error on chained narrowing: $name.&foo.&bar", () => {
      const result = parseFlatRoute("$name.&foo.&bar");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Static segment '&bar' does not narrow previous static segement '&foo'",
      );
    });

    it("should error on narrowing dynamic with dynamic: $name.&$other", () => {
      const result = parseFlatRoute("$name.&$other");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Dynamic segement '&$other' may not narrow previous dynamic segment '$name'",
      );
    });

    it("should parse (foo,bar,baz).(&foo,&baz) as /foo and /baz", () => {
      const result = parseFlatRoute("(foo,bar,baz).(&foo,&baz)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/baz");
    });

    it("should error on $$rest.&$$other.foo (wildcard followed by non-narrowing)", () => {
      const result = parseFlatRoute("$$rest.&$$other.foo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Catch-all segement '&$$other' may not narrow previous catch-all segment '$$rest'",
      );
    });

    it("should parse $name.(&foo,&bar).&foo as /foo", () => {
      const result = parseFlatRoute("$name.(&foo,&bar).&foo");
      // Expands to: $name.&foo.&foo and $name.&bar.&foo
      // $name.&foo.&foo -> /foo narrowed by &foo -> /foo matches -> /foo
      // $name.&bar.&foo -> /bar narrowed by &foo -> bar != foo -> filtered out
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/foo");
    });
  });

  describe("pathless and dynamic prefix combinations", () => {
    it("should parse _$name as /", () => {
      const result = parseFlatRoute("_$name");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/");
      expect(result.paths[0].segments[0].prefix).toBe("_");
      expect(result.paths[0].segments[0].dynamic).toBe(false);
      expect(result.paths[0].segments[0].name).toBe("$name");
    });

    it("should error on duplicate from two pathless alternates: _foo,_bar", () => {
      const result = parseFlatRoute("_foo,_bar");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Path '/_bar' duplicates '/_foo'");
    });

    it("should parse _$$rest as /", () => {
      const result = parseFlatRoute("_$$rest");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/");
      expect(result.paths[0].segments[0].prefix).toBe("_");
      expect(result.paths[0].segments[0].dynamic).toBe(false);
      expect(result.paths[0].segments[0].name).toBe("$$rest");
    });
  });

  describe("group edge cases", () => {
    it("should parse (,) as / and / (duplicate error)", () => {
      const result = parseFlatRoute("(,)");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Path '/' duplicates '/'");
    });

    it("should parse ((foo,bar)) same as (foo,bar)", () => {
      const result = parseFlatRoute("((foo,bar))");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/bar");
    });

    it("should parse (a,b,) as /a, /b, /", () => {
      const result = parseFlatRoute("(a,b,)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(3);
      expect(result.paths[0].key).toBe("/a");
      expect(result.paths[1].key).toBe("/b");
      expect(result.paths[2].key).toBe("/");
    });

    it("should parse (a,b,c,d) as four paths", () => {
      const result = parseFlatRoute("(a,b,c,d)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(4);
      expect(result.paths.map((p) => p.key)).toEqual([
        "/a",
        "/b",
        "/c",
        "/d",
      ]);
    });

    it("should parse deeply nested group: (a.(b.(c,d),e))", () => {
      const result = parseFlatRoute("(a.(b.(c,d),e))");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(3);
      expect(result.paths[0].key).toBe("/a/b/c");
      expect(result.paths[1].key).toBe("/a/b/d");
      expect(result.paths[2].key).toBe("/a/e");
    });

    it("should error on (a)(b) with unexpected '('", () => {
      const result = parseFlatRoute("(a)(b)");
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].message).toBe("Unexpected '('");
    });
  });

  describe("escaped edge cases", () => {
    it("should parse backtick in group: (`a.b`,foo)", () => {
      const result = parseFlatRoute("(`a.b`,foo)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/a.b");
      expect(result.paths[1].key).toBe("/foo");
    });

    it("should parse special chars in backtick: `.,()$_&`", () => {
      const result = parseFlatRoute("`.,()$_&`");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/.,()$_&");
    });

    it("should parse empty backtick pair as empty name", () => {
      const result = parseFlatRoute("``");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0].key).toBe("/");
    });
  });

  describe("complex alternate and group combinations", () => {
    it("should parse $.(,bar) as /$ and /$/bar", () => {
      const result = parseFlatRoute("$.(,bar)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].key).toBe("/$");
      expect(result.paths[1].key).toBe("/$/bar");
    });

    it("should parse a.(b,c).(d,e).f as 4 paths", () => {
      const result = parseFlatRoute("a.(b,c).(d,e).f");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(4);
      expect(result.paths.map((p) => p.key)).toEqual([
        "/a/b/d/f",
        "/a/b/e/f",
        "/a/c/d/f",
        "/a/c/e/f",
      ]);
    });

    it("should error on (,,,) with unexpected ','", () => {
      const result = parseFlatRoute("(,,,)");
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].message).toBe("Unexpected ','");
    });

    it("should parse a.b.c,d.e.f,g as three paths", () => {
      const result = parseFlatRoute("a.b.c,d.e.f,g");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(3);
      expect(result.paths[0].key).toBe("/a/b/c");
      expect(result.paths[1].key).toBe("/d/e/f");
      expect(result.paths[2].key).toBe("/g");
    });

    it("should parse (foo,bar).(,baz) as 4 paths", () => {
      const result = parseFlatRoute("(foo,bar).(,baz)");
      expect(result.errors).toEqual([]);
      expect(result.paths).toHaveLength(4);
      expect(result.paths[0].key).toBe("/foo");
      expect(result.paths[1].key).toBe("/foo/baz");
      expect(result.paths[2].key).toBe("/bar");
      expect(result.paths[3].key).toBe("/bar/baz");
    });
  });
});
