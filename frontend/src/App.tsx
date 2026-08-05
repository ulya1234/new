import React, { useEffect, useRef, useState } from "react";
import {
  Undo, Redo, Bold, Italic, Underline, Strikethrough, Type, Code,
  List, ListOrdered, Quote, FolderKanban, Table as TableIcon,
  Image as ImageIcon, Menu, X, Plus, Trash2, Columns, Rows,
  AlignLeft, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  Link as LinkIcon, EyeOff, Highlighter, Indent, Outdent, Eraser,
  Sun, Moon
} from "lucide-react";

interface HeadingData {
  id: string;
  text: string;
  level: number;
}

interface MediaItem {
  type: "img" | "video" | "audio";
  url: string;
}

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
  const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState<boolean>(false);
  
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
  
  const [tableMenu, setTableMenu] = useState<{ show: boolean; top: number; left: number; cell: HTMLTableCellElement | null }>({
    show: false, top: 0, left: 0, cell: null
  });
  
  const [activeFormats, setActiveFormats] = useState({
    bold: false, italic: false, underline: false, strikeThrough: false, ul: false, ol: false, highlight: false, spoiler: false
  });

  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
    }

    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      tg.MainButton.setText("SEND ARTICLE");
      
      if (tg.colorScheme === "light") {
        setTheme("light");
      } else {
        setTheme("dark");
      }
      
      tg.MainButton.onClick(() => {
        if (!editorRef.current) return;
        const textLen = editorRef.current.innerText?.length || 0;
        
        if (textLen === 0) {
          tg.showAlert("Please enter some content before sending.");
          return;
        }
        if (textLen > MAX_CHARS) {
          tg.showAlert(`Character limit exceeded! Maximum is ${MAX_CHARS.toLocaleString()}.`);
          return;
        }
        
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
          }).then(() => {
            tg.close();
          }).catch(() => {
            console.error("[API Error] Failed to publish the article via API");
            tg.showAlert("Failed to publish the article.");
            tg.MainButton.hideProgress();
          });
        } else {
          console.log("[Core] Sending HTML payload to Telegram WebApp");
          tg.sendData(JSON.stringify({ markdown: generatedHtml }));
        }
      });
    }
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      if (charCount > 0 && charCount <= MAX_CHARS) {
        tg.MainButton.show();
      } else {
        tg.MainButton.hide();
      }
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

  const handleEditorInteraction = (e?: React.MouseEvent | React.KeyboardEvent | React.SyntheticEvent) => {
    saveSelection();
    
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
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
      highlight: isHighlight,
      spoiler: isSpoiler
    });
    
    if (editorRef.current) {
      setCharCount(editorRef.current.innerText?.length || 0);
    }
    
    if (e && e.type === "click") {
      const target = e.target as HTMLElement;
      if (target.classList.contains("tg-spoiler")) {
        target.classList.toggle("revealed");
      }

      const td = target.closest("td, th") as HTMLTableCellElement;
      if (td) {
        const rect = td.getBoundingClientRect();
        let calculatedLeft = rect.left;
        if (calculatedLeft + 180 > window.innerWidth) {
          calculatedLeft = window.innerWidth - 190;
        }
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
          
          if (isQuote && node.textContent?.trim() === "") {
            e.preventDefault();
            document.execCommand('formatBlock', false, 'p');
            return;
          }
          
          if (isTable) {
            e.preventDefault();
            const tableWrapper = element?.closest('.table-responsive') || isTable;
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            tableWrapper.parentNode?.insertBefore(p, tableWrapper.nextSibling);
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }
        }
      }
    }
    handleEditorInteraction();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const plainText = e.clipboardData.getData("text/plain");

    // Jika teks yang disalin mengandung tag HTML murni (seperti <h1>, <b>, <hr/>), 
    // render langsung sebagai HTML ke dalam editor
    if (/<[a-z/][\s\S]*>/i.test(plainText)) {
      document.execCommand("insertHTML", false, plainText);
    } else {
      // Jika teks biasa, format menjadi paragraf agar rapi
      const html = plainText
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .split(/\n\n+/)
        .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
        .join('');
      document.execCommand("insertHTML", false, html);
    }
    handleEditorInteraction();
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    restoreSelection();
    document.execCommand(command, false, value);
    handleEditorInteraction();
    setIsHeadingMenuOpen(false);
  };

  const toggleCustomFormat = (tag: string, className?: string) => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    let node = selection.anchorNode;
    let parent = node?.nodeType === 3 ? node.parentElement : node as HTMLElement;
    let targetNode = null;
    
    while (parent && parent !== editorRef.current) {
      if (parent.tagName.toLowerCase() === tag && (!className || parent.classList.contains(className))) {
        targetNode = parent;
        break;
      }
      parent = parent.parentElement;
    }
    
    if (targetNode) {
      const docFrag = document.createDocumentFragment();
      while (targetNode.firstChild) {
        docFrag.appendChild(targetNode.firstChild);
      }
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

  const openLinkModal = () => {
    saveSelection();
    const selection = window.getSelection();
    setLinkText(selection?.toString() || "");
    setLinkUrl("");
    setIsLinkModalOpen(true);
  };

  const submitLink = () => {
    restoreSelection();
    if (linkUrl) {
      const html = `<a href="${linkUrl}">${linkText || linkUrl}</a>`;
      document.execCommand("insertHTML", false, html);
    }
    setIsLinkModalOpen(false);
    handleEditorInteraction();
  };

  const submitCodeBlock = () => {
    restoreSelection();
    const lang = codeLang.trim();
    const html = `<p><br></p><div class="code-wrapper"><pre spellcheck="false" data-language="${lang}"><code class="language-${lang}">// Write ${lang || 'code'} here...</code></pre></div><p><br></p>`;
    document.execCommand("insertHTML", false, html);
    setIsCodeModalOpen(false);
    setCodeLang("");
    handleEditorInteraction();
  };

  const insertCollapsible = () => {
    restoreSelection();
    const html = `<p><br></p><details open><summary>Details Section</summary><p>Content...</p></details><p><br></p>`;
    document.execCommand("insertHTML", false, html);
    handleEditorInteraction();
  };

  const insertInitialTable = () => {
    restoreSelection();
    let tableHtml = "<p><br></p><div class='table-responsive'><table><thead><tr>";
    for (let c = 1; c <= cols; c++) { tableHtml += `<th>Header ${c}</th>`; }
    tableHtml += "</tr></thead><tbody>";
    for (let r = 1; r <= rows; r++) {
      tableHtml += "<tr>";
      for (let c = 1; c <= cols; c++) { tableHtml += `<td>Cell ${r}-${c}</td>`; }
      tableHtml += "</tr>";
    }
    tableHtml += "</tbody></table></div><p><br></p>";
    
    document.execCommand("insertHTML", false, tableHtml);
    setIsTableModalOpen(false);
    handleEditorInteraction();
  };

  const insertMedia = () => {
    restoreSelection();
    const validItems = mediaItems.filter(m => m.url.trim() !== "");
    if (validItems.length === 0) {
      setIsMediaModalOpen(false);
      return;
    }
    
    let html = `<p><br></p>`;
    if (mediaLayout === "single") {
      const item = validItems[0];
      const tag = item.type === "img" ? "img" : item.type === "video" ? "video" : "audio";
      
      if (mediaCaption) {
        html += `<figure><${tag} src="${item.url}" controls /><figcaption>${mediaCaption}</figcaption></figure>`;
      } else {
        html += `<div class="media-wrapper"><${tag} src="${item.url}" controls /></div>`;
      }
    } else {
      const containerTag = mediaLayout === "collage" ? "tg-collage" : "tg-slideshow";
      html += `<${containerTag} contenteditable="false">`;
      validItems.forEach(item => {
        const tag = item.type === "img" ? "img" : item.type === "video" ? "video" : "audio";
        html += `<${tag} src="${item.url}" controls />`;
      });
      if (mediaCaption) {
        html += `<figcaption>${mediaCaption}</figcaption>`;
      }
      html += `</${containerTag}>`;
    }
    
    html += `<p><br></p>`;
    document.execCommand("insertHTML", false, html);
    setIsMediaModalOpen(false);
    setMediaItems([{ type: "img", url: "" }]);
    setMediaCaption("");
    handleEditorInteraction();
  };

  const addMediaItem = () => {
    if (mediaItems.length < 50) {
      setMediaItems([...mediaItems, { type: "img", url: "" }]);
    }
  };

  const updateMediaItem = (index: number, key: keyof MediaItem, value: string) => {
    const updated = [...mediaItems];
    updated[index] = { ...updated[index], [key]: value };
    setMediaItems(updated);
  };

  const removeMediaItem = (index: number) => {
    if (mediaItems.length > 1) {
      setMediaItems(mediaItems.filter((_, i) => i !== index));
    }
  };

  const addTableRow = () => {
    if (!tableMenu.cell) return;
    const tr = tableMenu.cell.closest("tr");
    if (!tr) return;
    const newTr = document.createElement("tr");
    Array.from(tr.children).forEach(() => {
      const td = document.createElement("td");
      td.textContent = "New Cell";
      newTr.appendChild(td);
    });
    tr.after(newTr);
    setTableMenu({ show: false, top: 0, left: 0, cell: null });
    handleEditorInteraction();
  };

  const addTableColumn = () => {
    if (!tableMenu.cell) return;
    const tr = tableMenu.cell.closest("tr");
    const table = tableMenu.cell.closest("table");
    if (!tr || !table) return;
    const index = Array.from(tr.children).indexOf(tableMenu.cell);
    Array.from(table.rows).forEach((row) => {
      const isHeader = row.closest("thead") !== null;
      const cell = document.createElement(isHeader ? "th" : "td");
      cell.textContent = isHeader ? "New Header" : "New Cell";
      if (row.children[index]) {
        row.children[index].after(cell);
      } else {
        row.appendChild(cell);
      }
    });
    setTableMenu({ show: false, top: 0, left: 0, cell: null });
    handleEditorInteraction();
  };

  const removeTableRow = () => {
    if (!tableMenu.cell) return;
    const tr = tableMenu.cell.closest("tr");
    if (tr) tr.remove();
    setTableMenu({ show: false, top: 0, left: 0, cell: null });
    handleEditorInteraction();
  };

  const removeTableColumn = () => {
    if (!tableMenu.cell) return;
    const tr = tableMenu.cell.closest("tr");
    const table = tableMenu.cell.closest("table");
    if (!tr || !table) return;
    const index = Array.from(tr.children).indexOf(tableMenu.cell);
    Array.from(table.rows).forEach((row) => {
      if (row.children[index]) row.children[index].remove();
    });
    setTableMenu({ show: false, top: 0, left: 0, cell: null });
    handleEditorInteraction();
  };

  const compileToTelegramHtml = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.nodeName.toLowerCase();
      
      let innerHTML = Array.from(el.childNodes).map(c => compileToTelegramHtml(c)).join('');

      switch (tag) {
        // Inline Tags
        case "b": case "strong": return `<b>${innerHTML}</b>`;
        case "i": case "em": return `<i>${innerHTML}</i>`;
        case "u": case "ins": return `<u>${innerHTML}</u>`;
        case "s": case "strike": case "del": return `<s>${innerHTML}</s>`;
        case "mark": return `<mark>${innerHTML}</mark>`;
        case "code": return `<code>${innerHTML}</code>`;
        case "sup": return `<sup>${innerHTML}</sup>`;
        case "sub": return `<sub>${innerHTML}</sub>`;
        case "cite": return `<cite>${innerHTML}</cite>`;
        case "span":
          if (el.classList.contains("tg-spoiler")) return `<tg-spoiler>${innerHTML}</tg-spoiler>`;
          return innerHTML;
        case "a": return `<a href="${el.getAttribute("href") || ""}">${innerHTML}</a>`;
        
        // Block Tags & Paragraphs
        case "p": case "div":
          if (!innerHTML.trim() && el.querySelector('br')) return `<br>\n`;
          return `<p>${innerHTML}</p>\n`;
        case "br": return `<br>\n`;
        case "hr": return `<hr/>\n`;
        case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
          return `<${tag}>${innerHTML}</${tag}>\n`;
        case "blockquote": return `<blockquote>${innerHTML}</blockquote>\n`;
        case "aside": return `<aside>${innerHTML}</aside>\n`;
        
        // Lists
        case "ul": case "ol": return `<${tag}>\n${innerHTML}</${tag}>\n`;
        case "li": return `<li>${innerHTML}</li>\n`;
        
        // Tables
        case "table": return `<table>\n${innerHTML}</table>\n`;
        case "thead": case "tbody": return `${innerHTML}`;
        case "tr": return `<tr>${innerHTML}</tr>\n`;
        case "th": case "td": return `<${tag}>${innerHTML}</${tag}>`;
        
        // Interactive / Telegram specific
        case "details": return `<details open>\n${innerHTML}</details>\n`;
        case "summary": return `<summary>${innerHTML}</summary>\n`;
        
        // Media & Code
        case "pre":
          const lang = el.getAttribute("data-language");
          if (lang) return `<pre><code class="language-${lang}">${innerHTML}</code></pre>\n`;
          return `<pre>${innerHTML}</pre>\n`;
        case "figure": return `<figure>\n${innerHTML}</figure>\n`;
        case "img": case "video": case "audio":
          return `<${tag} src="${el.getAttribute("src") || ""}"></${tag}>\n`;
        case "tg-collage": case "tg-slideshow":
          return `<${tag}>\n${innerHTML}</${tag}>\n`;
        case "figcaption": return `<figcaption>${innerHTML}</figcaption>\n`;
        
        default:
          return innerHTML;
      }
    }
    return "";
  };

  const handleTabSwitch = (tab: "visual" | "source") => {
    setActiveTab(tab);
    if (tab === "source" && editorRef.current) {
      let html = compileToTelegramHtml(editorRef.current);
      // Membersihkan kelebihan spasi baris agar terlihat padat & rapi
      html = html.replace(/\n\n+/g, '\n').trim();
      setHtmlOutput(html);
    }
  };

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  return (
    <div className={`app-wrapper theme-${theme}`}>
      <div className={`sidebar-overlay ${isSidebarOpen ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)} />
      <nav className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Table of Contents</span>
          <button className="icon-btn-flat" onClick={() => setIsSidebarOpen(false)}><X size={18} /></button>
        </div>
        <div className="sidebar-content">
          {headings.length === 0 ? (
            <div className="empty-state">No headings found</div>
          ) : (
            headings.map((h) => (
              <div key={h.id} className={`toc-item level-${h.level}`} onClick={() => scrollToHeading(h.id)}>
                <span className="toc-text">{h.text}</span>
              </div>
            ))
          )}
        </div>
      </nav>

      <div className="main-content">
        <header className="top-bar">
          <div className="top-left">
            <button className="icon-btn-flat" onClick={() => setIsSidebarOpen(true)}><Menu size={18} /></button>
            <button className="icon-btn-flat" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="undo-redo-group">
              <button className="icon-btn-flat" onClick={() => executeCommand("undo")}><Undo size={16} /></button>
              <button className="icon-btn-flat" onClick={() => executeCommand("redo")}><Redo size={16} /></button>
            </div>
          </div>
          <div className="tab-switcher">
            <button onClick={() => handleTabSwitch("visual")} className={`tab-btn ${activeTab === "visual" ? "active" : ""}`}>Editor</button>
            <button onClick={() => handleTabSwitch("source")} className={`tab-btn ${activeTab === "source" ? "active" : ""}`}>Source</button>
          </div>
        </header>

        <main className="editor-container">
          <div className={`tab-content ${activeTab === "visual" ? "active" : ""}`}>
            <div
              ref={editorRef}
              contentEditable={true}
              onKeyDown={handleKeyDown}
              onKeyUp={handleEditorInteraction}
              onMouseUp={handleEditorInteraction}
              onInput={handleEditorInteraction}
              onClick={handleEditorInteraction}
              onPaste={handlePaste}
              className="editor-surface"
              data-placeholder="Start typing your document here..."
            />
          </div>
          
          <div className={`tab-content ${activeTab === "source" ? "active" : ""}`}>
            <pre className="markdown-preview">
              {htmlOutput || "No content generated yet."}
            </pre>
          </div>
        </main>

        <footer className="bottom-info">
          <span className={charCount > MAX_CHARS ? "text-danger" : ""}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
          </span>
          {charCount > MAX_CHARS && <div className="limit-warning">Limit exceeded!</div>}
        </footer>

        {activeTab === "visual" && tableMenu.show && (
          <div className="table-context-menu" style={{ top: tableMenu.top, left: tableMenu.left }}>
            <button onMouseDown={(e) => { e.preventDefault(); addTableRow(); }}><Rows size={14} /> <span>Add Row Below</span></button>
            <button onMouseDown={(e) => { e.preventDefault(); addTableColumn(); }}><Columns size={14} /> <span>Add Column Right</span></button>
            <div className="menu-divider" />
            <button onMouseDown={(e) => { e.preventDefault(); removeTableRow(); }} className="danger"><Trash2 size={14} /> <span>Delete Row</span></button>
            <button onMouseDown={(e) => { e.preventDefault(); removeTableColumn(); }} className="danger"><Trash2 size={14} /> <span>Delete Column</span></button>
          </div>
        )}

        {activeTab === "visual" && (
          <div className="smart-toolbar-container">
            {isHeadingMenuOpen && (
              <div className="heading-popover">
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h1>"); }}><Heading1 size={16} /> <span>Heading 1</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h2>"); }}><Heading2 size={16} /> <span>Heading 2</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h3>"); }}><Heading3 size={16} /> <span>Heading 3</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h4>"); }}><Heading4 size={16} /> <span>Heading 4</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h5>"); }}><Heading5 size={16} /> <span>Heading 5</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h6>"); }}><Heading6 size={16} /> <span>Heading 6</span></button>
                <div className="menu-divider" />
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<p>"); }}><Type size={16} /> <span>Paragraph</span></button>
              </div>
            )}
            <div className="smart-toolbar">
              <div className="toolbar-inner">
                <button onMouseDown={(e) => { e.preventDefault(); setIsHeadingMenuOpen(!isHeadingMenuOpen); }} className={`tool-btn ${isHeadingMenuOpen ? 'active' : ''}`}><Type size={16} /></button>
                <div className="divider" />
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("bold"); }} className={`tool-btn ${activeFormats.bold ? "active" : ""}`}><Bold size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("italic"); }} className={`tool-btn ${activeFormats.italic ? "active" : ""}`}><Italic size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("underline"); }} className={`tool-btn ${activeFormats.underline ? "active" : ""}`}><Underline size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("strikeThrough"); }} className={`tool-btn ${activeFormats.strikeThrough ? "active" : ""}`}><Strikethrough size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); removeFormat(); }} className="tool-btn"><Eraser size={16} /></button>
                <div className="divider" />
                <button onMouseDown={(e) => { e.preventDefault(); toggleCustomFormat("mark"); }} className={`tool-btn ${activeFormats.highlight ? "active" : ""}`}><Highlighter size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); toggleCustomFormat("span", "tg-spoiler"); }} className={`tool-btn ${activeFormats.spoiler ? "active" : ""}`}><EyeOff size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); openLinkModal(); }} className="tool-btn"><LinkIcon size={16} /></button>
                <div className="divider" />
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyLeft"); }} className="tool-btn"><AlignLeft size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("insertUnorderedList"); }} className={`tool-btn ${activeFormats.ul ? "active" : ""}`}><List size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("insertOrderedList"); }} className={`tool-btn ${activeFormats.ol ? "active" : ""}`}><ListOrdered size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("indent"); }} className="tool-btn"><Indent size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("outdent"); }} className="tool-btn"><Outdent size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<blockquote>"); }} className="tool-btn"><Quote size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsCodeModalOpen(true); }} className="tool-btn"><Code size={16} /></button>
                <div className="divider" />
                <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsMediaModalOpen(true); }} className="tool-btn"><ImageIcon size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsTableModalOpen(true); }} className="tool-btn"><TableIcon size={16} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); insertCollapsible(); }} className="tool-btn"><FolderKanban size={16} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`modal-overlay ${isTableModalOpen ? "active" : ""}`}>
        <div className="modal-box">
          <h2>Insert Table</h2>
          <div className="modal-grid">
            <div className="input-group">
              <label>Rows</label>
              <input type="number" value={rows} min={1} max={15} onChange={(e) => setRows(parseInt(e.target.value, 10) || 1)} />
            </div>
            <div className="input-group">
              <label>Columns</label>
              <input type="number" value={cols} min={1} max={6} onChange={(e) => setCols(parseInt(e.target.value, 10) || 1)} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setIsTableModalOpen(false)}>Cancel</button>
            <button className="btn-submit" onClick={insertInitialTable}>Insert</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${isMediaModalOpen ? "active" : ""}`}>
        <div className="modal-box media-modal">
          <h2>Insert Media</h2>
          <div className="input-group">
            <label>Display Layout</label>
            <select value={mediaLayout} onChange={(e) => {
              setMediaLayout(e.target.value as any);
              if (e.target.value === "single") setMediaItems([mediaItems[0] || { type: "img", url: "" }]);
            }}>
              <option value="single">Single Media</option>
              <option value="collage">Collage (Grid)</option>
              <option value="slideshow">Slideshow (Swipe)</option>
            </select>
          </div>
          
          <div className="media-items-container">
            {mediaItems.map((item, index) => (
              <div key={index} className="media-item-row">
                <select value={item.type} onChange={(e) => updateMediaItem(index, "type", e.target.value)}>
                  <option value="img">Photo</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                </select>
                <input type="text" placeholder="https://..." value={item.url} onChange={(e) => updateMediaItem(index, "url", e.target.value)} />
                {mediaLayout !== "single" && mediaItems.length > 1 && (
                  <button className="btn-remove-media" onClick={() => removeMediaItem(index)}><Trash2 size={16} /></button>
                )}
              </div>
            ))}
          </div>
          
          {mediaLayout !== "single" && mediaItems.length < 50 && (
            <button className="btn-add-media" onClick={addMediaItem}><Plus size={16} /> Add another media</button>
          )}
          <div className="input-group" style={{marginTop: '12px'}}>
            <label>Caption / Group Title</label>
            <input type="text" placeholder="Optional description..." value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setIsMediaModalOpen(false)}>Cancel</button>
            <button className="btn-submit" onClick={insertMedia}>Insert Media</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${isLinkModalOpen ? "active" : ""}`}>
        <div className="modal-box">
          <h2>Insert Hyperlink</h2>
          <div className="input-group">
            <label>Text to display</label>
            <input type="text" placeholder="Click here" value={linkText} onChange={(e) => setLinkText(e.target.value)} />
          </div>
          <div className="input-group">
            <label>URL</label>
            <input type="text" placeholder="https://t.me/..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setIsLinkModalOpen(false)}>Cancel</button>
            <button className="btn-submit" onClick={submitLink}>Apply Link</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${isCodeModalOpen ? "active" : ""}`}>
        <div className="modal-box">
          <h2>Insert Code Block</h2>
          <div className="input-group">
            <label>Programming Language (Optional)</label>
            <input type="text" placeholder="e.g. python, javascript" value={codeLang} onChange={(e) => setCodeLang(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setIsCodeModalOpen(false)}>Cancel</button>
            <button className="btn-submit" onClick={submitCodeBlock}>Insert Code</button>
          </div>
        </div>
      </div>
    </div>
  );
}