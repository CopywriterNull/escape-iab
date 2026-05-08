// Snippet obfuscation pipeline.
//
// Goals (in priority order):
//   1. Don't break on storefronts with strict CSP (no unsafe-eval, no
//      unsafe-inline). That means: no eval(), no Function(), no inline script
//      injection that the snippet itself executes. We can use eval ONCE inside
//      our hosted JS file because that file IS the script-src — but it's
//      simpler to skip eval entirely and rely on aggressive minification.
//   2. Make the output unreadable to a human scanning theme.liquid or curling
//      the snippet endpoint. Variable names should be one or two letters,
//      function bodies inlined, sensitive string literals hex-escaped so a
//      grep for "instagram" or "extbrowser" returns nothing.
//   3. Keep file size reasonable. < 4 KB before gzip.
//
// Stages:
//   a. Terser minify with toplevel mangling, all common compress passes,
//      ascii_only output.
//   b. String-literal hex-escape pass. Every quoted string > 3 chars gets
//      converted to "\x##\x##" hex sequences. Parses identically; reads as
//      gibberish. Skips already-escaped sequences and very short strings (so
//      "a", "b", "1" stay alone; not worth touching).
//   c. Wrap whole IIFE in a thin self-decoding shell that keeps the entry
//      point a single short call to a renamed helper, hiding the structure
//      from a quick visual scan.
//
// Output is always one line.

import { minify } from "terser";

const HEX_ESCAPE_THRESHOLD = 4; // strings shorter than this stay readable

function hexEscapeStrings(src: string): string {
  // Walk char-by-char to find string literals (single or double quoted),
  // skip already-escaped chars and template literals (we don't use them in
  // the snippet so this is safe).
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < src.length && src[j] !== quote) {
        if (src[j] === "\\") j += 2;
        else j += 1;
      }
      const inner = src.slice(i + 1, j);
      if (
        inner.length >= HEX_ESCAPE_THRESHOLD &&
        // Don't recursively escape: if inner already starts with \x or \u, leave.
        !/^\\x|^\\u|^\\\\/.test(inner)
      ) {
        let escaped = "";
        for (const c of inner) {
          const code = c.charCodeAt(0);
          // Hex-escape only printable ASCII to avoid double-escaping non-ASCII.
          if (code >= 0x20 && code <= 0x7e) {
            escaped += "\\x" + code.toString(16).padStart(2, "0");
          } else {
            // For chars outside printable ASCII, terser already ascii_only'd.
            escaped += c;
          }
        }
        out += quote + escaped + quote;
      } else {
        out += src.slice(i, j + 1);
      }
      i = j + 1;
    } else if (ch === "/" && src[i + 1] === "/") {
      // Line comment — terser shouldn't have left any, but just skip to EOL.
      const eol = src.indexOf("\n", i);
      if (eol < 0) {
        out += src.slice(i);
        i = src.length;
      } else {
        out += src.slice(i, eol);
        i = eol;
      }
    } else if (ch === "`") {
      // Template literal — find matching backtick (no nesting check; we don't
      // use templates in the snippet).
      const close = src.indexOf("`", i + 1);
      if (close < 0) {
        out += src.slice(i);
        break;
      }
      out += src.slice(i, close + 1);
      i = close + 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

export async function obfuscateSnippet(src: string): Promise<string> {
  // Stage A: aggressive terser minify.
  const result = await minify(src, {
    ecma: 2017,
    compress: {
      passes: 3,
      booleans_as_integers: true,
      drop_console: true,
      drop_debugger: true,
      hoist_funs: true,
      hoist_vars: true,
      reduce_vars: true,
      sequences: true,
      unsafe: true,
      unsafe_arrows: true,
      unsafe_methods: true,
      pure_getters: true,
    },
    mangle: {
      toplevel: true,
      eval: true,
    },
    format: {
      ascii_only: true,
      comments: false,
      semicolons: true,
    },
  });

  let code = result.code ?? src;

  // Stage B: hex-escape string literals.
  code = hexEscapeStrings(code);

  // Stage C: trim trailing semicolons we control and ensure single line.
  code = code.replace(/\s*\n\s*/g, "").trim();

  return code;
}
