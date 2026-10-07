/* ============================================================
   LAB — ferramentas de análise de binário que rodam dentro do
   navegador. Sem build, sem dependência, sem servidor: o arquivo
   escolhido é lido com File.arrayBuffer() e interpretado aqui.
   Nada sai da máquina de quem está vendo a página.
   ============================================================ */

(function () {
  "use strict";

  const MAX_BYTES = 32 * 1024 * 1024; // acima disso o parse vira desperdício
  const HEX_BYTES = 512; // trecho mostrado no hex dump
  const STRING_SCAN_BYTES = 8 * 1024 * 1024;
  const MAX_STRINGS = 300;
  const MAX_SECTIONS = 96;
  const SECTION_SCAN_BYTES = 1 << 20; // entropia amostrada por seção

  const ELF_MACHINES = {
    0x03: "x86",
    0x08: "MIPS",
    0x15: "PowerPC",
    0x16: "IBM S/390",
    0x28: "ARM",
    0x2a: "SuperH",
    0x32: "IA-64",
    0x3e: "x86-64",
    0xb7: "AArch64",
    0xf3: "RISC-V"
  };

  const PE_MACHINES = {
    0x014c: "x86",
    0x01c0: "ARM",
    0x01c4: "ARMv7",
    0x0200: "IA-64",
    0x8664: "x86-64",
    0xaa64: "ARM64"
  };

  const ELF_TYPES = { 1: "REL (relocável)", 2: "EXEC", 3: "DYN (PIE/shared)", 4: "CORE" };
  const ELF_OSABI = { 0: "System V", 1: "HP-UX", 2: "NetBSD", 3: "Linux", 6: "Solaris", 9: "FreeBSD" };
  const PE_SUBSYSTEMS = { 1: "Native", 2: "Windows GUI", 3: "Windows CUI", 7: "POSIX CUI", 9: "Windows CE", 10: "EFI" };

  /* ---------- leitura de bytes ---------- */

  function field(view, off, size, le) {
    if (off < 0 || off + size > view.byteLength) {
      return null;
    }
    if (size === 1) {
      return view.getUint8(off);
    }
    if (size === 2) {
      return view.getUint16(off, le);
    }
    if (size === 4) {
      return view.getUint32(off, le);
    }
    return Number(view.getBigUint64(off, le));
  }

  function hex(value, pad) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "—";
    }
    return `0x${value.toString(16).toUpperCase().padStart(pad || 2, "0")}`;
  }

  function bytesSize(value) {
    if (value === null || value === undefined) {
      return "—";
    }
    if (value < 1024) {
      return `${value} B`;
    }
    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KiB`;
    }
    return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
  }

  function cstring(bytes, start, max) {
    if (start < 0 || start >= bytes.length) {
      return "";
    }
    const end = Math.min(bytes.length, start + (max || 64));
    let out = "";
    for (let i = start; i < end; i += 1) {
      const value = bytes[i];
      if (value === 0) {
        break;
      }
      out += value >= 32 && value <= 126 ? String.fromCharCode(value) : "?";
    }
    return out;
  }

  /* entropia de Shannon sobre um trecho: 0 = constante, 8 = aleatório.
     É o sinal barato que separa código de bloco comprimido ou cifrado. */
  function entropy(bytes, start, length) {
    if (!Number.isFinite(start) || start < 0 || start >= bytes.length || length <= 0) {
      return null;
    }
    const counts = new Uint32Array(256);
    const end = Math.min(bytes.length, start + length);
    let total = 0;

    for (let i = start; i < end; i += 1) {
      counts[bytes[i]] += 1;
      total += 1;
    }
    if (!total) {
      return null;
    }

    let value = 0;
    for (let i = 0; i < 256; i += 1) {
      if (!counts[i]) {
        continue;
      }
      const p = counts[i] / total;
      value -= p * Math.log2(p);
    }
    return value;
  }

  function hexPreview(bytes, length) {
    const out = [];
    for (let i = 0; i < Math.min(bytes.length, length); i += 1) {
      out.push(bytes[i].toString(16).toUpperCase().padStart(2, "0"));
    }
    return out.join(" ") || "—";
  }

  function hexDump(bytes, limit) {
    const lines = [];
    const end = Math.min(bytes.length, limit);

    for (let off = 0; off < end; off += 16) {
      let hexPart = "";
      let asciiPart = "";

      for (let i = 0; i < 16; i += 1) {
        const value = bytes[off + i];
        if (value === undefined) {
          hexPart += "   ";
        } else {
          hexPart += `${value.toString(16).toUpperCase().padStart(2, "0")}${i === 7 ? "  " : " "}`;
          asciiPart += value >= 32 && value <= 126 ? String.fromCharCode(value) : ".";
        }
      }
      lines.push(`${off.toString(16).toUpperCase().padStart(8, "0")}  ${hexPart} |${asciiPart}|`);
    }
    return lines.join("\n") || "(arquivo vazio)";
  }

  function extractStrings(bytes, min, limit) {
    const out = [];
    let start = -1;

    for (let i = 0; i < bytes.length; i += 1) {
      const value = bytes[i];
      if (value >= 32 && value <= 126) {
        if (start < 0) {
          start = i;
        }
      } else if (start >= 0) {
        if (i - start >= min) {
          out.push(cstring(bytes, start, i - start));
          if (out.length >= limit) {
            return out;
          }
        }
        start = -1;
      }
    }

    if (start >= 0 && bytes.length - start >= min && out.length < limit) {
      out.push(cstring(bytes, start, bytes.length - start));
    }
    return out;
  }

  /* ---------- ELF ---------- */

  function parseELF(bytes, view) {
    const bits = bytes[4] === 2 ? 64 : 32;
    const le = bytes[5] !== 2;
    const wide = bits === 64;
    const word = wide ? 8 : 4;

    const type = field(view, 16, 2, le);
    const machine = field(view, 18, 2, le);
    const entry = field(view, 24, word, le);
    const phoff = field(view, wide ? 32 : 28, word, le);
    const phentsize = field(view, wide ? 54 : 42, 2, le);
    const phnum = field(view, wide ? 56 : 44, 2, le);
    const shoff = field(view, wide ? 40 : 32, word, le);
    const shentsize = field(view, wide ? 58 : 46, 2, le);
    const shnum = field(view, wide ? 60 : 48, 2, le);
    const shstrndx = field(view, wide ? 62 : 50, 2, le);

    const rows = [
      ["Classe", `ELF${bits} · ${le ? "little-endian" : "big-endian"}`],
      ["OS/ABI", ELF_OSABI[bytes[7]] || hex(bytes[7], 2)],
      ["Tipo", ELF_TYPES[type] || hex(type, 2)],
      ["Máquina", ELF_MACHINES[machine] || hex(machine, 4)],
      ["Entry point", hex(entry, wide ? 16 : 8)],
      ["Cabeçalhos de programa", `${phnum ?? "—"} entradas de ${phentsize ?? "—"} B em ${hex(phoff, 8)}`],
      ["Tabela de seções", `${shnum ?? "—"} entradas de ${shentsize ?? "—"} B em ${hex(shoff, 8)}`]
    ];

    const sections = [];

    if (shoff !== null && shentsize && shnum && shnum <= MAX_SECTIONS * 4) {
      const strtabEntry = shoff + (shstrndx ?? 0) * shentsize;
      const strtabOff = field(view, strtabEntry + (wide ? 24 : 16), word, le);
      const strtabSize = field(view, strtabEntry + (wide ? 32 : 20), word, le);
      const total = Math.min(shnum, MAX_SECTIONS);

      for (let i = 0; i < total; i += 1) {
        const base = shoff + i * shentsize;
        const nameOff = field(view, base, 4, le);
        const shType = field(view, base + 4, 4, le);
        const addr = field(view, base + (wide ? 16 : 12), word, le);
        const off = field(view, base + (wide ? 24 : 16), word, le);
        const len = field(view, base + (wide ? 32 : 20), word, le);
        const nobits = shType === 8; // SHT_NOBITS não ocupa bytes na imagem

        sections.push({
          name: cstring(bytes, (strtabOff ?? 0) + (nameOff ?? 0), Math.min(strtabSize ?? 64, 256)) || `[${i}]`,
          addr,
          fileSize: nobits ? null : len,
          entropy: nobits ? null : entropy(bytes, off ?? -1, Math.min(len ?? 0, SECTION_SCAN_BYTES))
        });
      }
    }

    return {
      format: `ELF${bits} ${le ? "LE" : "BE"} · ${ELF_MACHINES[machine] || "máquina desconhecida"}`,
      rows,
      sections
    };
  }

  /* ---------- PE ---------- */

  function parsePE(bytes, view) {
    const lfanew = field(view, 0x3c, 4, true) ?? 0;

    if (field(view, lfanew, 4, true) !== 0x00004550) {
      return {
        format: "MZ sem cabeçalho PE (provavelmente executável DOS)",
        rows: [["e_lfanew", hex(lfanew, 8)]],
        sections: []
      };
    }

    const coff = lfanew + 4;
    const machine = field(view, coff, 2, true);
    const count = field(view, coff + 2, 2, true);
    const stamp = field(view, coff + 4, 4, true);
    const optSize = field(view, coff + 16, 2, true) ?? 0;
    const flags = field(view, coff + 18, 2, true);
    const opt = coff + 20;
    const plus = field(view, opt, 2, true) === 0x20b; // 0x20b = PE32+

    const rows = [
      ["Formato", plus ? "PE32+ (64 bits)" : "PE32 (32 bits)"],
      ["Máquina", PE_MACHINES[machine] || hex(machine, 4)],
      ["Entry point (RVA)", hex(field(view, opt + 16, 4, true), 8)],
      ["Image base", hex(plus ? field(view, opt + 24, 8, true) : field(view, opt + 28, 4, true), plus ? 16 : 8)],
      ["Alinhamento de seção", hex(field(view, opt + 32, 4, true), 8)],
      ["Subsistema", PE_SUBSYSTEMS[field(view, opt + 68, 2, true)] || hex(field(view, opt + 68, 2, true), 4)],
      ["TimeDateStamp", hex(stamp, 8)],
      ["Characteristics", hex(flags, 4)]
    ];

    const sections = [];
    const start = opt + optSize;
    const total = Math.min(count ?? 0, MAX_SECTIONS);

    for (let i = 0; i < total; i += 1) {
      const base = start + i * 40;
      const rawPtr = field(view, base + 20, 4, true);
      const rawSize = field(view, base + 16, 4, true);

      sections.push({
        name: cstring(bytes, base, 8) || `[${i}]`,
        addr: field(view, base + 12, 4, true),
        fileSize: rawSize,
        entropy: entropy(bytes, rawPtr ?? -1, Math.min(rawSize ?? 0, SECTION_SCAN_BYTES))
      });
    }

    return {
      format: `PE · ${PE_MACHINES[machine] || "máquina desconhecida"}`,
      rows,
      sections
    };
  }

  function parseBinary(bytes, view) {
    const isELF = bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46;

    if (isELF) {
      return parseELF(bytes, view);
    }
    if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
      return parsePE(bytes, view);
    }
    return {
      format: "formato não reconhecido (nem ELF nem PE)",
      rows: [["Primeiros 16 bytes", hexPreview(bytes, 16)]],
      sections: []
    };
  }

  /* ---------- render ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function entropyCell(value) {
    const cell = el("span", "lab-ent-cell");
    if (value === null || value === undefined || !Number.isFinite(value)) {
      cell.textContent = "—";
      return cell;
    }
    cell.appendChild(el("b", "lab-ent-num", value.toFixed(2)));
    const bar = el("span", "lab-ent");
    const fill = el("i");
    fill.style.width = `${Math.round((value / 8) * 100)}%`;
    bar.appendChild(fill);
    cell.appendChild(bar);
    return cell;
  }

  function renderHeaders(out, file, report) {
    out.textContent = "";
    out.appendChild(el("p", "lab-file", `${file.name} · ${bytesSize(file.size)}`));

    const rows = el("dl", "lab-rows");
    report.rows.forEach((pair) => {
      if (pair[1] === null || pair[1] === undefined) {
        return;
      }
      const row = el("div", "lab-row");
      row.appendChild(el("dt", "lab-key", pair[0]));
      row.appendChild(el("dd", "lab-val", String(pair[1])));
      rows.appendChild(row);
    });
    out.appendChild(rows);

    if (!report.sections.length) {
      out.hidden = false;
      return;
    }

    const block = el("div", "lab-sub");
    block.appendChild(el("p", "lab-label", `seções — ${report.sections.length}`));

    const head = el("tr");
    ["Seção", "Endereço", "Bytes na imagem", "Entropia (bits/byte)"].forEach((title) => {
      head.appendChild(el("th", null, title));
    });
    const thead = el("thead");
    thead.appendChild(head);

    const body = el("tbody");
    report.sections.forEach((section) => {
      const row = el("tr");
      row.appendChild(el("td", "lab-name", section.name));
      row.appendChild(el("td", null, hex(section.addr, 8)));
      row.appendChild(el("td", null, bytesSize(section.fileSize)));
      const cell = el("td");
      cell.appendChild(entropyCell(section.entropy));
      row.appendChild(cell);
      body.appendChild(row);
    });

    const table = el("table", "lab-table");
    table.appendChild(thead);
    table.appendChild(body);

    const scroll = el("div", "lab-scroll");
    scroll.appendChild(table);
    block.appendChild(scroll);
    out.appendChild(block);
    out.hidden = false;
  }

  function renderStrings(out, file, bytes, min) {
    const scan = bytes.subarray(0, Math.min(bytes.length, STRING_SCAN_BYTES));
    const found = extractStrings(scan, min, MAX_STRINGS);

    out.textContent = "";
    out.appendChild(el("p", "lab-file", `${file.name} · ${bytesSize(file.size)} · mínimo de ${min} caracteres`));
    out.appendChild(
      el("p", "lab-label", `strings — ${found.length}${found.length >= MAX_STRINGS ? "+" : ""} encontradas`)
    );

    const list = el("ul", "lab-list");
    if (!found.length) {
      list.appendChild(el("li", null, "nenhuma sequência legível acima desse tamanho."));
    }
    found.forEach((value) => list.appendChild(el("li", null, value)));
    out.appendChild(list);

    const block = el("div", "lab-sub");
    block.appendChild(el("p", "lab-label", `hex dump — primeiros ${Math.min(bytes.length, HEX_BYTES)} bytes`));
    block.appendChild(el("pre", "lab-pre", hexDump(bytes, HEX_BYTES)));
    out.appendChild(block);
    out.hidden = false;
  }

  /* ---------- ligação com a página ---------- */

  function bindPicker(root, input, onFile) {
    const drop = root.querySelector(".lab-drop");
    const name = root.querySelector(".lab-drop-name");

    const accept = (file) => {
      if (!file) {
        return;
      }
      input.value = ""; // permite reescolher o mesmo arquivo
      if (name) {
        name.textContent = file.name;
      }
      onFile(file);
    };

    input.addEventListener("change", () => accept(input.files && input.files[0]));

    if (!drop) {
      return;
    }

    ["dragenter", "dragover"].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.add("is-over");
      });
    });

    ["dragleave", "drop"].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.remove("is-over");
      });
    });

    drop.addEventListener("drop", (event) => {
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files[0]) {
        accept(files[0]);
      }
    });
  }

  function readBytes(file) {
    return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }

  const headerTool = document.getElementById("lab-headers");

  if (headerTool) {
    const input = headerTool.querySelector("input[type=file]");
    const out = headerTool.querySelector(".lab-out");
    const status = headerTool.querySelector(".lab-status");

    bindPicker(headerTool, input, (file) => {
      out.hidden = true;
      status.textContent = `lendo ${file.name}…`;

      if (file.size > MAX_BYTES) {
        status.textContent = "arquivo grande demais (limite: 32 MiB).";
        return;
      }

      readBytes(file)
        .then((bytes) => {
          const report = parseBinary(bytes, new DataView(bytes.buffer));
          status.textContent = report.format;
          renderHeaders(out, file, report);
        })
        .catch(() => {
          status.textContent = "não consegui ler o arquivo.";
        });
    });
  }

  const stringTool = document.getElementById("lab-strings");

  if (stringTool) {
    const input = stringTool.querySelector("input[type=file]");
    const minInput = stringTool.querySelector("input[type=number]");
    const out = stringTool.querySelector(".lab-out");
    const status = stringTool.querySelector(".lab-status");
    let loaded = null;

    const repaint = () => {
      if (loaded) {
        renderStrings(out, loaded.file, loaded.bytes, Math.max(4, Math.min(64, Number(minInput.value) || 6)));
      }
    };

    bindPicker(stringTool, input, (file) => {
      out.hidden = true;
      status.textContent = `lendo ${file.name}…`;

      if (file.size > MAX_BYTES) {
        status.textContent = "arquivo grande demais (limite: 32 MiB).";
        return;
      }

      readBytes(file)
        .then((bytes) => {
          loaded = { file, bytes };
          status.textContent = file.name;
          repaint();
        })
        .catch(() => {
          status.textContent = "não consegui ler o arquivo.";
        });
    });

    minInput.addEventListener("change", repaint);
  }
})();
