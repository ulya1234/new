import React, { useEffect, useRef, useState } from "react";
import {
  Undo, Redo, Bold, Italic, Underline, Strikethrough, Type, Code,
  List as ListIcon, ListOrdered, Quote, FolderKanban, Table as TableIcon,
  Image as ImageIcon, Menu, X, Plus, Trash2, Columns, Rows,
  AlignLeft, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  Link as LinkIcon, EyeOff, Highlighter, Indent, Outdent, Eraser,
  Sun, Moon, Baseline, CheckSquare, Minus, Superscript, Subscript,
  MapPin, Clock, Bookmark, Crosshair
} from "lucide-react";

interface HeadingData { id: string; text: string; level: number; }
interface MediaItem { type: "img" | "video" | "audio"; url: string; }

const MAX_CHARS = 32768;

export default function App() {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  
  const [activeTab, setActiveTab] = useState<"visual" | "source">("visual");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [htmlOutput, setHtmlOutput] = useState<string>("");
  const [charCount, setCharCount] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [headings, setHeadings] = useState<HeadingData[]>([]);
  const [activeMenu, setActiveMenu] = useState<"text" | "struct" | "list" | "insert" | null>(null);
  
  const [isMediaModalOpen, setIsMediaModalOpen] = useState<boolean>(false);
  const [mediaLayout, setMediaLayout] = useState<"single" | "collage" | "slideshow">("single");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([{ type: "img", url: "" }]);
  const [mediaCaption, setMediaCaption] = useState<string>("");
  
  const [isTableModalOpen, setIsTableModalOpen] = useState<boolean>(false);
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(2);
  
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [linkText, setLinkText] = useState<string>("");
  
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [codeLang, setCodeLang] = useState<string>("");

  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);
  const [mapLat, setMapLat] = useState<string>("");
  const [mapLong, setMapLong] = useState<string>("");
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const [isTimeModalOpen, setIsTimeModalOpen] = useState<boolean>(false);
  const [timeUnix, setTimeUnix] = useState<string>("");
  const [timeFormat, setTimeFormat] = useState<string>("wDT");
  const [timeText, setTimeText] = useState<string>("");

  const [isRefModalOpen, setIsRefModalOpen] = useState<boolean>(false);
  const [refName, setRefName] = useState<string>("");
  const [refText, setRefText] = useState<string>("");
  
  const [tableMenu, setTableMenu] = useState<{ show: boolean; top: number; left: number; cell: HTMLTableCellElement | null }>({
    show: false, top: 0, left: 0, cell: null
  });
  
  const [activeFormats, setActiveFormats] = useState({
    bold: false, italic: false, underline: false, strikeThrough: false, ul: false, ol: false, highlight: false, spoiler: false
  });

  useEffect(() => {
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch {}

    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      tg.MainButton.setText("KIRIM ARTIKEL");
      
      if (tg.colorScheme === "light") setTheme("light");
      else setTheme("dark");
      
      tg.MainButton.onClick(() => {
        if (!editorRef.current) return;
        const textLen = editorRef.current.innerText?.length || 0;
        
        if (textLen === 0) { tg.showAlert("Tulis sesuatu sebelum mengirim."); return; }
        if (textLen > MAX_CHARS) { tg.showAlert(`Batas karakter melebihi maksimal ${MAX_CHARS.toLocaleString()}.`); return; }
        
        let generatedHtml = compileToTelegramHtml(editorRef.current);
        generatedHtml = generatedHtml.replace(/\n\s*\n/g, '\n').trim();
        
        const urlParams = new URLSearchParams(window.location.search);
        const apiUrl = urlParams.get("api");
        const chatId = tg.initDataUnsafe?.user?.id || tg.initDataUnsafe?.chat?.id;
        
        if (apiUrl && chatId) {
          tg.MainButton.showProgress();
          fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, markdown: generatedHtml })
          }).then(() => tg.close()).catch(() => { tg.showAlert("Gagal mempublikasikan artikel."); tg.MainButton.hideProgress(); });
        } else {
          tg.sendData(JSON.stringify({ markdown: generatedHtml }));
        }
      });
    }
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      if (charCount > 0 && charCount <= MAX_CHARS) tg.MainButton.show();
      else tg.MainButton.hide();
    }
  }, [charCount]);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selectionRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (editorRef.current && selectionRangeRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRangeRef.current);
    } else if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const updateTableOfContents = () => {
    if (!editorRef.current) return;
    const headingElements = editorRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const toc: HeadingData[] = Array.from(headingElements).map((el) => {
      if (!el.id) el.id = `heading-${Math.random().toString(36).substring(2, 11)}`;
      return { id: el.id, text: el.textContent || "Untitled", level: parseInt(el.tagName.charAt(1)) };
    });
    setHeadings(toc);
  };

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleEditorInteraction = (e?: React.MouseEvent | React.KeyboardEvent | React.SyntheticEvent) => {
    saveSelection();
    if (e && e.type === "click") setActiveMenu(null);
    
    let isHighlight = false;
    let isSpoiler = false;
    const selection = window.getSelection();
    
    if (selection && selection.rangeCount > 0) {
      let node = selection.anchorNode;
      let parent = node?.nodeType === 3 ? node.parentElement : node as HTMLElement;
      while (parent && parent !== editorRef.current) {
        if (parent.tagName.toLowerCase() === 'mark') isHighlight = true;
        if (parent.tagName.toLowerCase() === 'span' && parent.classList.contains('tg-spoiler')) isSpoiler = true;
        parent = parent.parentElement;
      }
    }

    setActiveFormats({
      bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), underline: document.queryCommandState("underline"), strikeThrough: document.queryCommandState("strikeThrough"), ul: document.queryCommandState("insertUnorderedList"), ol: document.queryCommandState("insertOrderedList"), highlight: isHighlight, spoiler: isSpoiler
    });
    
    if (editorRef.current) setCharCount(editorRef.current.innerText?.length || 0);
    
    if (e && e.type === "click") {
      const target = e.target as HTMLElement;
      if (target.classList.contains("tg-spoiler")) target.classList.toggle("revealed");

      const td = target.closest("td, th") as HTMLTableCellElement;
      if (td) {
        const rect = td.getBoundingClientRect();
        let calculatedLeft = rect.left;
        if (calculatedLeft + 180 > window.innerWidth) calculatedLeft = window.innerWidth - 190;
        setTableMenu({ show: true, top: rect.bottom + 8, left: calculatedLeft, cell: td });
      } else {
        setTableMenu({ show: false, top: 0, left: 0, cell: null });
      }
    }
    updateTableOfContents();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const node = selection.focusNode;
        if (node) {
          const element = node.nodeType === 3 ? node.parentElement : node as HTMLElement;
          const isQuote = element?.closest('blockquote');
          const isTable = element?.closest('table');
          
          if (isQuote && node.textContent?.trim() === "") { e.preventDefault(); document.execCommand('formatBlock', false, 'p'); return; }
          if (isTable) {
            e.preventDefault();
            const tableWrapper = element?.closest('.table-responsive') || isTable;
            const p = document.createElement('p'); p.innerHTML = '<br>';
            tableWrapper.parentNode?.insertBefore(p, tableWrapper.nextSibling);
            const newRange = document.createRange(); newRange.setStart(p, 0); newRange.collapse(true);
            selection.removeAllRanges(); selection.addRange(newRange); return;
          }
        }
      }
    }
    handleEditorInteraction();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const plainText = e.clipboardData.getData("text/plain");

    if (/<[a-z/][\s\S]*>/i.test(plainText)) {
      document.execCommand("insertHTML", false, plainText);
    } else {
      const html = plainText.replace(/</g, "&lt;").replace(/>/g, "&gt;").split(/\n\n+/).map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('');
      document.execCommand("insertHTML", false, html);
    }
    handleEditorInteraction();
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => { restoreSelection(); document.execCommand(command, false, value); handleEditorInteraction(); };

  const toggleCustomFormat = (tag: string, className?: string) => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    let node = selection.anchorNode;
    let parent = node?.nodeType === 3 ? node.parentElement : node as HTMLElement;
    let targetNode = null;
    
    while (parent && parent !== editorRef.current) {
      if (parent.tagName.toLowerCase() === tag && (!className || parent.classList.contains(className))) { targetNode = parent; break; }
      parent = parent.parentElement;
    }
    
    if (targetNode) {
      const docFrag = document.createDocumentFragment();
      while (targetNode.firstChild) docFrag.appendChild(targetNode.firstChild);
      targetNode.parentNode?.replaceChild(docFrag, targetNode);
    } else {
      const text = selection.toString();
      if (!text) return;
      const html = className ? `<${tag} class="${className}">${text}</${tag}>` : `<${tag}>${text}</${tag}>`;
      document.execCommand("insertHTML", false, html);
    }
    handleEditorInteraction();
  };

  const removeFormat = () => {
    restoreSelection();
    document.execCommand("removeFormat", false);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const parent = selection.anchorNode?.parentElement;
      if (parent && (parent.tagName === 'MARK' || parent.classList.contains('tg-spoiler'))) {
        const text = parent.innerText;
        parent.replaceWith(text);
      }
    }
    handleEditorInteraction();
  };

  /* Modal Actions */
  const openLinkModal = () => { saveSelection(); const selection = window.getSelection(); setLinkText(selection?.toString() || ""); setLinkUrl(""); setIsLinkModalOpen(true); };
  const submitLink = () => { restoreSelection(); if (linkUrl) document.execCommand("insertHTML", false, `<a href="${linkUrl}">${linkText || linkUrl}</a>`); setIsLinkModalOpen(false); handleEditorInteraction(); };
  const submitCodeBlock = () => { restoreSelection(); document.execCommand("insertHTML", false, `<p><br></p><div class="code-wrapper"><pre spellcheck="false" data-language="${codeLang.trim()}"><code class="language-${codeLang.trim()}">// Write ${codeLang || 'code'} here...</code></pre></div><p><br></p>`); setIsCodeModalOpen(false); setCodeLang(""); handleEditorInteraction(); };
  const insertCollapsible = () => { restoreSelection(); document.execCommand("insertHTML", false, `<p><br></p><details open><summary>Section Title</summary><p>Content...</p></details><p><br></p>`); setActiveMenu(null); handleEditorInteraction(); };
  const insertAside = () => { restoreSelection(); document.execCommand("insertHTML", false, `<p><br></p><aside>Pull quote<cite>The Author</cite></aside><p><br></p>`); setActiveMenu(null); handleEditorInteraction(); };
  const insertHorizontalRule = () => { restoreSelection(); document.execCommand("insertHorizontalRule"); setActiveMenu(null); handleEditorInteraction(); };
  const insertCheckbox = () => { restoreSelection(); document.execCommand("insertHTML", false, `<input type="checkbox" /> `); setActiveMenu(null); handleEditorInteraction(); };
  
  const insertInitialTable = () => {
    restoreSelection();
    let html = "<p><br></p><div class='table-responsive'><table><thead><tr>";
    for (let c = 1; c <= cols; c++) html += `<th>Header ${c}</th>`;
    html += "</tr></thead><tbody>";
    for (let r = 1; r <= rows; r++) { html += "<tr>"; for (let c = 1; c <= cols; c++) html += `<td>Cell ${r}-${c}</td>`; html += "</tr>"; }
    html += "</tbody></table></div><p><br></p>";
    document.execCommand("insertHTML", false, html); setIsTableModalOpen(false); handleEditorInteraction();
  };

  const insertMedia = () => {
    restoreSelection();
    const validItems = mediaItems.filter(m => m.url.trim() !== "");
    if (validItems.length === 0) { setIsMediaModalOpen(false); return; }
    let html = `<p><br></p>`;
    if (mediaLayout === "single") {
      const item = validItems[0]; const tag = item.type === "img" ? "img" : item.type === "video" ? "video" : "audio";
      if (mediaCaption) html += `<figure><${tag} src="${item.url}" controls /><figcaption>${mediaCaption}</figcaption></figure>`;
      else html += `<div class="media-wrapper"><${tag} src="${item.url}" controls /></div>`;
    } else {
      const cTag = mediaLayout === "collage" ? "tg-collage" : "tg-slideshow";
      html += `<${cTag} contenteditable="false">`;
      validItems.forEach(item => { const tag = item.type === "img" ? "img" : item.type === "video" ? "video" : "audio"; html += `<${tag} src="${item.url}" controls />`; });
      if (mediaCaption) html += `<figcaption>${mediaCaption}</figcaption>`; html += `</${cTag}>`;
    }
    html += `<p><br></p>`;
    document.execCommand("insertHTML", false, html); setIsMediaModalOpen(false); setMediaItems([{ type: "img", url: "" }]); setMediaCaption(""); handleEditorInteraction();
  };

  /* Time & Map Handlers */
  const fetchCurrentLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapLat(pos.coords.latitude.toFixed(5));
          setMapLong(pos.coords.longitude.toFixed(5));
          setIsLocating(false);
        },
        () => {
          alert("Gagal mengakses lokasi. Pastikan izin GPS aktif.");
          setIsLocating(false);
        }
      );
    } else {
      alert("Browser Anda tidak mendukung fitur lokasi.");
      setIsLocating(false);
    }
  };

  const fetchCurrentTime = () => {
    const now = new Date();
    setTimeUnix(Math.floor(now.getTime() / 1000).toString());
    const textFormat = now.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    setTimeText(textFormat);
  };

  const insertMap = () => { restoreSelection(); if (mapLat && mapLong) document.execCommand("insertHTML", false, ` <span class="tg-elem tg-map-vis" data-lat="${mapLat}" data-long="${mapLong}" contenteditable="false">📍 Map: ${mapLat}, ${mapLong}</span> `); setIsMapModalOpen(false); setMapLat(""); setMapLong(""); handleEditorInteraction(); };
  const insertTime = () => { restoreSelection(); if (timeUnix) document.execCommand("insertHTML", false, ` <span class="tg-elem tg-time-vis" data-unix="${timeUnix}" data-format="${timeFormat}" contenteditable="false">🕒 ${timeText || "Time"}</span> `); setIsTimeModalOpen(false); setTimeUnix(""); setTimeText(""); handleEditorInteraction(); };
  const insertReference = () => { restoreSelection(); if (refName) document.execCommand("insertHTML", false, ` <span class="tg-elem tg-reference-vis" data-name="${refName}" contenteditable="false">🔖 ${refText || refName}</span> `); setIsRefModalOpen(false); setRefName(""); setRefText(""); handleEditorInteraction(); };

  const addMediaItem = () => { if (mediaItems.length < 50) setMediaItems([...mediaItems, { type: "img", url: "" }]); };
  const updateMediaItem = (index: number, key: keyof MediaItem, value: string) => { const updated = [...mediaItems]; updated[index] = { ...updated[index], [key]: value }; setMediaItems(updated); };
  const removeMediaItem = (index: number) => { if (mediaItems.length > 1) setMediaItems(mediaItems.filter((_, i) => i !== index)); };

  const addTableRow = () => { if (!tableMenu.cell) return; const tr = tableMenu.cell.closest("tr"); if (!tr) return; const newTr = document.createElement("tr"); Array.from(tr.children).forEach(() => { const td = document.createElement("td"); td.textContent = "New Cell"; newTr.appendChild(td); }); tr.after(newTr); setTableMenu({ show: false, top: 0, left: 0, cell: null }); handleEditorInteraction(); };
  const addTableColumn = () => { if (!tableMenu.cell) return; const tr = tableMenu.cell.closest("tr"); const table = tableMenu.cell.closest("table"); if (!tr || !table) return; const index = Array.from(tr.children).indexOf(tableMenu.cell); Array.from(table.rows).forEach((row) => { const isHeader = row.closest("thead") !== null; const cell = document.createElement(isHeader ? "th" : "td"); cell.textContent = isHeader ? "New Header" : "New Cell"; if (row.children[index]) row.children[index].after(cell); else row.appendChild(cell); }); setTableMenu({ show: false, top: 0, left: 0, cell: null }); handleEditorInteraction(); };
  const removeTableRow = () => { if (!tableMenu.cell) return; const tr = tableMenu.cell.closest("tr"); if (tr) tr.remove(); setTableMenu({ show: false, top: 0, left: 0, cell: null }); handleEditorInteraction(); };
  const removeTableColumn = () => { if (!tableMenu.cell) return; const tr = tableMenu.cell.closest("tr"); const table = tableMenu.cell.closest("table"); if (!tr || !table) return; const index = Array.from(tr.children).indexOf(tableMenu.cell); Array.from(table.rows).forEach((row) => { if (row.children[index]) row.children[index].remove(); }); setTableMenu({ show: false, top: 0, left: 0, cell: null }); handleEditorInteraction(); };

  const compileToTelegramHtml = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement; const tag = el.nodeName.toLowerCase();
      if (el.classList.contains("tg-map-vis")) return `<tg-map lat="${el.getAttribute('data-lat')}" long="${el.getAttribute('data-long')}" zoom="14"/>\n`;
      if (el.classList.contains("tg-time-vis")) return `<tg-time unix="${el.getAttribute('data-unix')}" format="${el.getAttribute('data-format')}">${el.textContent?.replace('🕒 ', '')}</tg-time>`;
      if (el.classList.contains("tg-reference-vis")) return `<tg-reference name="${el.getAttribute('data-name')}">${el.textContent?.replace('🔖 ', '')}</tg-reference>`;
      
      let innerHTML = Array.from(el.childNodes).map(c => compileToTelegramHtml(c)).join('');
      switch (tag) {
        case "b": case "strong": return `<b>${innerHTML}</b>`;
        case "i": case "em": return `<i>${innerHTML}</i>`;
        case "u": case "ins": return `<u>${innerHTML}</u>`;
        case "s": case "strike": case "del": return `<s>${innerHTML}</s>`;
        case "mark": return `<mark>${innerHTML}</mark>`;
        case "code": return `<code>${innerHTML}</code>`;
        case "sup": return `<sup>${innerHTML}</sup>`;
        case "sub": return `<sub>${innerHTML}</sub>`;
        case "cite": return `<cite>${innerHTML}</cite>`;
        case "span": return el.classList.contains("tg-spoiler") ? `<tg-spoiler>${innerHTML}</tg-spoiler>` : innerHTML;
        case "a": return el.getAttribute("name") ? `<a name="${el.getAttribute("name")}"></a>` : `<a href="${el.getAttribute("href") || ""}">${innerHTML}</a>`;
        case "input": return el.getAttribute("type") === "checkbox" ? `<input type="checkbox"${el.hasAttribute("checked") || (el as HTMLInputElement).checked ? ' checked' : ''}>` : "";
        case "p": case "div": return (!innerHTML.trim() && el.querySelector('br')) ? `<br>\n` : `<p>${innerHTML}</p>\n`;
        case "br": return `<br>\n`; case "hr": return `<hr/>\n`;
        case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": return `<${tag}>${innerHTML}</${tag}>\n`;
        case "blockquote": return `<blockquote>${innerHTML}</blockquote>\n`; case "aside": return `<aside>${innerHTML}</aside>\n`;
        case "ul": case "ol": return `<${tag}>\n${innerHTML}</${tag}>\n`; case "li": return `<li>${innerHTML}</li>\n`;
        case "table": return `<table>\n${innerHTML}</table>\n`; case "thead": case "tbody": return `${innerHTML}`; case "tr": return `<tr>${innerHTML}</tr>\n`; case "th": case "td": return `<${tag}>${innerHTML}</${tag}>`;
        case "details": return `<details open>\n${innerHTML}</details>\n`; case "summary": return `<summary>${innerHTML}</summary>\n`;
        case "pre": const lang = el.getAttribute("data-language"); return lang ? `<pre><code class="language-${lang}">${innerHTML}</code></pre>\n` : `<pre>${innerHTML}</pre>\n`;
        case "figure": return `<figure>\n${innerHTML}</figure>\n`; case "img": case "video": case "audio": return `<${tag} src="${el.getAttribute("src") || ""}"></${tag}>\n`;
        case "tg-collage": case "tg-slideshow": return `<${tag}>\n${innerHTML}</${tag}>\n`; case "figcaption": return `<figcaption>${innerHTML}</figcaption>\n`;
        default: return innerHTML;
      }
    }
    return "";
  };

  const handleTabSwitch = (tab: "visual" | "source") => {
    setActiveTab(tab);
    if (tab === "source" && editorRef.current) setHtmlOutput(compileToTelegramHtml(editorRef.current).replace(/\n\n+/g, '\n').trim());
  };

  const toggleMenu = (menu: "text" | "struct" | "list" | "insert") => {
    if (activeMenu === menu) setActiveMenu(null); else setActiveMenu(menu);
  };

  return (
    <div className={`app-wrapper theme-${theme}`}>
      <div className={`sidebar-overlay ${isSidebarOpen ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)} />
      <nav className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Daftar Isi</span>
          <button className="icon-btn-flat" onClick={() => setIsSidebarOpen(false)}><X size={18} /></button>
        </div>
        <div className="sidebar-content">
          {headings.length === 0 ? <div className="empty-state">Belum ada heading</div> : headings.map((h) => (<div key={h.id} className={`toc-item level-${h.level}`} onClick={() => scrollToHeading(h.id)}><span className="toc-text">{h.text}</span></div>))}
        </div>
      </nav>

      <div className="main-content">
        <header className="top-bar">
          <div className="top-left">
            <button className="icon-btn-flat" onClick={() => setIsSidebarOpen(true)}><Menu size={20}/></button>
            <button className="icon-btn-flat" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={20}/> : <Moon size={20}/>}</button>
            <div className="undo-redo-group">
              <button className="icon-btn-flat" onClick={() => executeCommand("undo")}><Undo size={18}/></button>
              <button className="icon-btn-flat" onClick={() => executeCommand("redo")}><Redo size={18}/></button>
            </div>
          </div>
          <div className="tab-switcher">
            <button onClick={() => handleTabSwitch("visual")} className={`tab-btn ${activeTab === "visual" ? "active" : ""}`}>Editor</button>
            <button onClick={() => handleTabSwitch("source")} className={`tab-btn ${activeTab === "source" ? "active" : ""}`}>Kode</button>
          </div>
        </header>

        <main className="editor-container" onClick={() => setActiveMenu(null)}>
          <div className={`tab-content ${activeTab === "visual" ? "active" : ""}`}>
            <div
              ref={editorRef}
              contentEditable={true}
              onKeyDown={handleKeyDown}
              onKeyUp={handleEditorInteraction}
              onMouseUp={handleEditorInteraction}
              onInput={handleEditorInteraction}
              onPaste={handlePaste}
              className="editor-surface"
              data-placeholder="Ketik artikel Telegram di sini..."
            />
          </div>
          <div className={`tab-content ${activeTab === "source" ? "active" : ""}`}>
            <pre className="markdown-preview">{htmlOutput || "Belum ada konten."}</pre>
          </div>
        </main>

        {activeTab === "visual" && tableMenu.show && (
          <div className="table-context-menu" style={{ top: tableMenu.top, left: tableMenu.left }}>
            <button onMouseDown={(e) => { e.preventDefault(); addTableRow(); }}><Rows size={16}/> <span>Tambah Baris</span></button>
            <button onMouseDown={(e) => { e.preventDefault(); addTableColumn(); }}><Columns size={16}/> <span>Tambah Kolom</span></button>
            <div className="menu-divider" />
            <button onMouseDown={(e) => { e.preventDefault(); removeTableRow(); }} className="danger"><Trash2 size={16}/> <span>Hapus Baris</span></button>
            <button onMouseDown={(e) => { e.preventDefault(); removeTableColumn(); }} className="danger"><Trash2 size={16}/> <span>Hapus Kolom</span></button>
          </div>
        )}

        {/* PIXEL FLOATING UI - CENTERED */}
        {activeTab === "visual" && (
          <div className="bottom-island-container">
            <div className="island-wrapper">
              <div className={`floating-sheet ${activeMenu ? 'open' : ''}`}>
                {activeMenu === 'text' && (
                  <div className="sheet-grid">
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("bold"); }} className={`pixel-btn ${activeFormats.bold ? "active" : ""}`}><Bold size={18}/> Bold</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("italic"); }} className={`pixel-btn ${activeFormats.italic ? "active" : ""}`}><Italic size={18}/> Italic</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("underline"); }} className={`pixel-btn ${activeFormats.underline ? "active" : ""}`}><Underline size={18}/> U-line</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("strikeThrough"); }} className={`pixel-btn ${activeFormats.strikeThrough ? "active" : ""}`}><Strikethrough size={18}/> Strike</button>
                    <button onMouseDown={(e) => { e.preventDefault(); toggleCustomFormat("mark"); }} className={`pixel-btn ${activeFormats.highlight ? "active" : ""}`}><Highlighter size={18}/> Sorot</button>
                    <button onMouseDown={(e) => { e.preventDefault(); toggleCustomFormat("span", "tg-spoiler"); }} className={`pixel-btn ${activeFormats.spoiler ? "active" : ""}`}><EyeOff size={18}/> Spoiler</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("superscript"); }} className="pixel-btn"><Superscript size={18}/> Super</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("subscript"); }} className="pixel-btn"><Subscript size={18}/> Sub</button>
                    <button onMouseDown={(e) => { e.preventDefault(); removeFormat(); }} className="pixel-btn text-danger"><Eraser size={18}/> Bersih</button>
                  </div>
                )}
                {activeMenu === 'struct' && (
                  <div className="sheet-grid">
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h1>"); }} className="pixel-btn"><Heading1 size={18}/> H1</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h2>"); }} className="pixel-btn"><Heading2 size={18}/> H2</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h3>"); }} className="pixel-btn"><Heading3 size={18}/> H3</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<p>"); }} className="pixel-btn"><Type size={18}/> Teks</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyLeft"); }} className="pixel-btn"><AlignLeft size={18}/> Kiri</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<blockquote>"); }} className="pixel-btn"><Quote size={18}/> Kutip</button>
                    <button onMouseDown={(e) => { e.preventDefault(); insertAside(); }} className="pixel-btn"><Quote size={18}/> Tarik</button>
                    <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsCodeModalOpen(true); }} className="pixel-btn"><Code size={18}/> Kode</button>
                  </div>
                )}
                {activeMenu === 'list' && (
                  <div className="sheet-grid">
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("insertUnorderedList"); }} className={`pixel-btn ${activeFormats.ul ? "active" : ""}`}><ListIcon size={18}/> Titik</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("insertOrderedList"); }} className={`pixel-btn ${activeFormats.ol ? "active" : ""}`}><ListOrdered size={18}/> Angka</button>
                    <button onMouseDown={(e) => { e.preventDefault(); insertCheckbox(); }} className="pixel-btn"><CheckSquare size={18}/> Ceklis</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("indent"); }} className="pixel-btn"><Indent size={18}/> Masuk</button>
                    <button onMouseDown={(e) => { e.preventDefault(); executeCommand("outdent"); }} className="pixel-btn"><Outdent size={18}/> Keluar</button>
                    <button onMouseDown={(e) => { e.preventDefault(); insertHorizontalRule(); }} className="pixel-btn"><Minus size={18}/> Garis</button>
                  </div>
                )}
                {activeMenu === 'insert' && (
                  <div className="sheet-grid">
                    <button onMouseDown={(e) => { e.preventDefault(); openLinkModal(); }} className="pixel-btn"><LinkIcon size={18}/> Link</button>
                    <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsMediaModalOpen(true); }} className="pixel-btn"><ImageIcon size={18}/> Media</button>
                    <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsTableModalOpen(true); }} className="pixel-btn"><TableIcon size={18}/> Tabel</button>
                    <button onMouseDown={(e) => { e.preventDefault(); insertCollapsible(); }} className="pixel-btn"><FolderKanban size={18}/> Lipat</button>
                    <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsMapModalOpen(true); }} className="pixel-btn"><MapPin size={18}/> Peta</button>
                    <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsTimeModalOpen(true); }} className="pixel-btn"><Clock size={18}/> Waktu</button>
                    <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsRefModalOpen(true); }} className="pixel-btn"><Bookmark size={18}/> Note</button>
                  </div>
                )}
              </div>

              <nav className="floating-nav-dock">
                <button className={`nav-icon ${activeMenu === 'text' ? 'active' : ''}`} onClick={() => toggleMenu('text')}>
                  <Baseline size={20} />
                </button>
                <button className={`nav-icon ${activeMenu === 'struct' ? 'active' : ''}`} onClick={() => toggleMenu('struct')}>
                  <Type size={20} />
                </button>
                <button className={`nav-icon ${activeMenu === 'list' ? 'active' : ''}`} onClick={() => toggleMenu('list')}>
                  <ListIcon size={20} />
                </button>
                <div className="nav-divider" />
                <button className={`nav-icon btn-action ${activeMenu === 'insert' ? 'active' : ''}`} onClick={() => toggleMenu('insert')}>
                  <Plus size={20} />
                </button>
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <div className={`modal-overlay ${isTableModalOpen ? "active" : ""}`}>
        <div className="modal-box pixel-box">
          <h2>Sisipkan Tabel</h2>
          <div className="modal-grid">
            <div className="input-group">
              <label>Baris</label>
              <input type="number" value={rows} min={1} max={15} onChange={(e) => setRows(parseInt(e.target.value, 10) || 1)} />
            </div>
            <div className="input-group">
              <label>Kolom</label>
              <input type="number" value={cols} min={1} max={6} onChange={(e) => setCols(parseInt(e.target.value, 10) || 1)} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="pixel-btn-outline" onClick={() => setIsTableModalOpen(false)}>Batal</button>
            <button className="pixel-btn-primary" onClick={insertInitialTable}>Sisipkan</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${isMediaModalOpen ? "active" : ""}`}>
        <div className="modal-box pixel-box media-modal">
          <h2>Sisipkan Media</h2>
          <div className="input-group">
            <label>Tampilan</label>
            <select value={mediaLayout} onChange={(e) => {
              setMediaLayout(e.target.value as any);
              if (e.target.value === "single") setMediaItems([mediaItems[0] || { type: "img", url: "" }]);
            }}>
              <option value="single">Satu Media</option>
              <option value="collage">Kolase Grid</option>
              <option value="slideshow">Geser (Slideshow)</option>
            </select>
          </div>
          <div className="media-items-container">
            {mediaItems.map((item, index) => (
              <div key={index} className="media-item-row">
                <select value={item.type} onChange={(e) => updateMediaItem(index, "type", e.target.value)}>
                  <option value="img">Foto</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                </select>
                <input type="text" placeholder="https://..." value={item.url} onChange={(e) => updateMediaItem(index, "url", e.target.value)} />
                {mediaLayout !== "single" && mediaItems.length > 1 && (
                  <button className="btn-remove-media" onClick={() => removeMediaItem(index)}><Trash2 size={16}/></button>
                )}
              </div>
            ))}
          </div>
          {mediaLayout !== "single" && mediaItems.length < 50 && (
            <button className="btn-add-media pixel-btn-outline" onClick={addMediaItem}><Plus size={16}/> Tambah Media</button>
          )}
          <div className="input-group" style={{marginTop: '12px'}}>
            <label>Keterangan (Opsional)</label>
            <input type="text" placeholder="Tulis deskripsi..." value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="pixel-btn-outline" onClick={() => setIsMediaModalOpen(false)}>Batal</button>
            <button className="pixel-btn-primary" onClick={insertMedia}>Sisipkan</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${isLinkModalOpen ? "active" : ""}`}>
        <div className="modal-box pixel-box">
          <h2>Tautan (Link)</h2>
          <div className="input-group">
            <label>Teks</label>
            <input type="text" placeholder="Klik di sini" value={linkText} onChange={(e) => setLinkText(e.target.value)} />
          </div>
          <div className="input-group">
            <label>URL</label>
            <input type="text" placeholder="https://t.me/..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="pixel-btn-outline" onClick={() => setIsLinkModalOpen(false)}>Batal</button>
            <button className="pixel-btn-primary" onClick={submitLink}>Terapkan</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${isCodeModalOpen ? "active" : ""}`}>
        <div className="modal-box pixel-box">
          <h2>Blok Kode</h2>
          <div className="input-group">
            <label>Bahasa Pemrograman</label>
            <input type="text" placeholder="python, javascript, dll..." value={codeLang} onChange={(e) => setCodeLang(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="pixel-btn-outline" onClick={() => setIsCodeModalOpen(false)}>Batal</button>
            <button className="pixel-btn-primary" onClick={submitCodeBlock}>Sisipkan</button>
          </div>
        </div>
      </div>

      {/* NEW MAP MODAL WITH GEOLOCATION */}
      <div className={`modal-overlay ${isMapModalOpen ? "active" : ""}`}>
        <div className="modal-box pixel-box">
          <h2>Sisipkan Lokasi</h2>
          <button className="pixel-btn-action-wide" onClick={fetchCurrentLocation} disabled={isLocating}>
            <Crosshair size={16}/> {isLocating ? "Mencari Lokasi..." : "Gunakan Lokasi Saya Sekarang"}
          </button>
          <div className="modal-grid" style={{marginTop: '12px'}}>
            <div className="input-group">
              <label>Garis Lintang (Lat)</label>
              <input type="text" placeholder="-7.8032" value={mapLat} onChange={(e) => setMapLat(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Garis Bujur (Long)</label>
              <input type="text" placeholder="110.3648" value={mapLong} onChange={(e) => setMapLong(e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="pixel-btn-outline" onClick={() => setIsMapModalOpen(false)}>Batal</button>
            <button className="pixel-btn-primary" onClick={insertMap}>Sisipkan</button>
          </div>
        </div>
      </div>

      {/* NEW TIME MODAL WITH AUTO TIME */}
      <div className={`modal-overlay ${isTimeModalOpen ? "active" : ""}`}>
        <div className="modal-box pixel-box">
          <h2>Waktu Interaktif</h2>
          <button className="pixel-btn-action-wide" onClick={fetchCurrentTime}>
            <Clock size={16}/> Ambil Waktu Saat Ini
          </button>
          <div className="input-group" style={{marginTop: '12px'}}>
            <label>Stempel Waktu (Unix)</label>
            <input type="text" placeholder="1710000000" value={timeUnix} onChange={(e) => setTimeUnix(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Teks Tampilan</label>
            <input type="text" placeholder="Hari ini jam 10" value={timeText} onChange={(e) => setTimeText(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="pixel-btn-outline" onClick={() => setIsTimeModalOpen(false)}>Batal</button>
            <button className="pixel-btn-primary" onClick={insertTime}>Sisipkan</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${isRefModalOpen ? "active" : ""}`}>
        <div className="modal-box pixel-box">
          <h2>Catatan Kaki (Footnote)</h2>
          <div className="input-group">
            <label>ID Referensi</label>
            <input type="text" placeholder="catatan-1" value={refName} onChange={(e) => setRefName(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Isi Catatan</label>
            <input type="text" placeholder="Informasi tambahan di sini..." value={refText} onChange={(e) => setRefText(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="pixel-btn-outline" onClick={() => setIsRefModalOpen(false)}>Batal</button>
            <button className="pixel-btn-primary" onClick={insertReference}>Sisipkan</button>
          </div>
        </div>
      </div>
    </div>
  );
}