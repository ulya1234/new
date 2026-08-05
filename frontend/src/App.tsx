import React, { useEffect, useRef, useState } from "react";
import {
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Type,
  Code,
  List,
  ListOrdered,
  Quote,
  FolderKanban,
  Table as TableIcon,
  Image as ImageIcon,
  Menu,
  X,
  Plus,
  Trash2,
  Columns,
  Rows,
  AlignLeft,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Link as LinkIcon,
  EyeOff,
  Highlighter,
  Indent,
  Outdent,
  Eraser
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

  const [activeTab, setActiveTab] = useState<"visual" | "markdown">("visual");
  const [markdownOutput, setMarkdownOutput] = useState<string>("");
  const [charCount, setCharCount] = useState<number>(0);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [headings, setHeadings] = useState<HeadingData[]>([]);

  const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState<boolean>(false);
  
  // Media Modal States
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
    bold: false, italic: false, underline: false, strikeThrough: false, ul: false, ol: false,
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      tg.MainButton.setText("SEND ARTICLE");
      
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
        
        let generatedMarkdown = compileHtmlToMarkdown(editorRef.current);
        generatedMarkdown = generatedMarkdown.replace(/\n{3,}/g, '\n\n').trim();

        const urlParams = new URLSearchParams(window.location.search);
        const apiUrl = urlParams.get("api");
        const chatId = tg.initDataUnsafe?.user?.id || tg.initDataUnsafe?.chat?.id;

        if (apiUrl && chatId) {
          tg.MainButton.showProgress();
          fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, markdown: generatedMarkdown })
          }).then(() => {
            tg.close();
          }).catch(() => {
            tg.showAlert("Failed to publish the article.");
            tg.MainButton.hideProgress();
          });
        } else {
          tg.sendData(JSON.stringify({ markdown: generatedMarkdown }));
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
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
    });

    if (editorRef.current) {
      setCharCount(editorRef.current.innerText?.length || 0);
    }

    if (e && e.type === "click") {
      const target = e.target as HTMLElement;
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
          if (isQuote && node.textContent?.trim() === "") {
            e.preventDefault();
            document.execCommand('formatBlock', false, 'p');
            return;
          }

          const isTable = element?.closest('table');
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
    const text = e.clipboardData.getData("text/plain");
    
    let html = text
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
      .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*?)\*/gim, '<i>$1</i>')
      .replace(/__(.*?)__/gim, '<u>$1</u>')
      .replace(/~~(.*?)~~/gim, '<s>$1</s>')
      .replace(/==(.*?)==/gim, '<mark>$1</mark>')
      .replace(/\|\|(.*?)\|\|/gim, '<span class="tg-spoiler">$1</span>')
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

    html = html.split(/\n\n+/).map(para => {
      if (para.trim().startsWith('<h') || para.trim().startsWith('<blockquote')) {
        return para.replace(/\n/g, '<br>');
      }
      return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    document.execCommand("insertHTML", false, html);
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

    // Traverse up to find if already wrapped
    while (parent && parent !== editorRef.current) {
      if (parent.tagName.toLowerCase() === tag && (!className || parent.classList.contains(className))) {
        targetNode = parent;
        break;
      }
      parent = parent.parentElement;
    }

    if (targetNode) {
      // Unwrap: Extract inner content and replace the node
      const docFrag = document.createDocumentFragment();
      while (targetNode.firstChild) {
        docFrag.appendChild(targetNode.firstChild);
      }
      targetNode.parentNode?.replaceChild(docFrag, targetNode);
    } else {
      // Wrap selected text
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
      const captionAttr = mediaCaption ? `alt="${mediaCaption}" title="${mediaCaption}"` : "";
      html += `<div class="media-wrapper"><${tag} src="${item.url}" ${captionAttr} controls /></div>`;
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

  const compileHtmlToMarkdown = (node: Node, listDepth = 0): string => {
    let markdown = "";
    const children = node.childNodes;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      
      if (child.nodeType === Node.TEXT_NODE) {
        markdown += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        const tag = element.nodeName.toLowerCase();
        
        if (tag === "b" || tag === "strong") {
          markdown += `**${compileHtmlToMarkdown(element, listDepth)}**`;
        } else if (tag === "i" || tag === "em") {
          markdown += `*${compileHtmlToMarkdown(element, listDepth)}*`;
        } else if (tag === "u") {
          markdown += `__${compileHtmlToMarkdown(element, listDepth)}__`;
        } else if (tag === "s" || tag === "strike" || tag === "del") {
          markdown += `~~${compileHtmlToMarkdown(element, listDepth)}~~`;
        } else if (tag === "mark") {
          markdown += `==${compileHtmlToMarkdown(element, listDepth)}==`;
        } else if (tag === "span" && element.classList.contains("tg-spoiler")) {
          markdown += `||${compileHtmlToMarkdown(element, listDepth)}||`;
        } else if (tag === "a") {
          const href = element.getAttribute("href") || "";
          markdown += `[${compileHtmlToMarkdown(element, listDepth)}](${href})`;
        } else if (tag === "code") {
          markdown += `\`${element.textContent}\``;
        } else if (tag === "pre") {
          const lang = element.getAttribute("data-language") || "";
          const codeText = element.textContent || "";
          markdown += `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`;
        } else if (tag === "h1") { markdown += `\n# ${compileHtmlToMarkdown(element).trim()}\n\n`; } 
          else if (tag === "h2") { markdown += `\n## ${compileHtmlToMarkdown(element).trim()}\n\n`; } 
          else if (tag === "h3") { markdown += `\n### ${compileHtmlToMarkdown(element).trim()}\n\n`; } 
          else if (tag === "h4") { markdown += `\n#### ${compileHtmlToMarkdown(element).trim()}\n\n`; } 
          else if (tag === "h5") { markdown += `\n##### ${compileHtmlToMarkdown(element).trim()}\n\n`; } 
          else if (tag === "h6") { markdown += `\n###### ${compileHtmlToMarkdown(element).trim()}\n\n`; } 
          else if (tag === "blockquote") {
          const lines = compileHtmlToMarkdown(element, listDepth).trim().split("\n");
          markdown += "\n" + lines.map((l) => `> ${l}`).join("\n") + "\n\n";
        } else if (tag === "ul" || tag === "ol") {
          const items = element.children;
          let listIndex = 1;
          for (let j = 0; j < items.length; j++) {
            const li = items[j];
            if (li.nodeName.toLowerCase() === "li") {
              const prefixSpace = "  ".repeat(listDepth);
              const prefix = tag === "ol" ? `${listIndex}. ` : "- ";
              markdown += `${prefixSpace}${prefix}${compileHtmlToMarkdown(li, listDepth + 1).trim()}\n`;
              listIndex++;
            }
          }
          if (listDepth === 0) markdown += "\n";
        } else if (tag === "img" || tag === "video" || tag === "audio") {
          const src = element.getAttribute("src") || "";
          const alt = element.getAttribute("alt") || element.getAttribute("title") || "";
          markdown += `\n![${alt}](${src})\n\n`;
        } else if (tag === "tg-collage" || tag === "tg-slideshow") {
          let mediaMd = `\n<${tag}>\n\n`;
          const mediaChildren = element.childNodes;
          for (let j = 0; j < mediaChildren.length; j++) {
            const mc = mediaChildren[j] as HTMLElement;
            if (mc.nodeName.toLowerCase() === "img" || mc.nodeName.toLowerCase() === "video") {
              mediaMd += `![](${mc.getAttribute("src")})\n`;
            } else if (mc.nodeName.toLowerCase() === "figcaption") {
              mediaMd += `<figcaption>${mc.textContent}</figcaption>\n`;
            }
          }
          mediaMd += `\n</${tag}>\n\n`;
          markdown += mediaMd;
        } else if (tag === "table") {
          let tableMd = "\n";
          const trs = element.querySelectorAll("tr");
          trs.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll("th, td");
            let rowStr = "|";
            cells.forEach((cell) => {
              rowStr += ` ${compileHtmlToMarkdown(cell, listDepth).trim()} |`;
            });
            tableMd += rowStr + "\n";
            if (rowIndex === 0) {
              let divStr = "|";
              cells.forEach(() => { divStr += ":---|"; });
              tableMd += divStr + "\n";
            }
          });
          markdown += tableMd + "\n";
        } else if (tag === "details") {
          const summary = element.querySelector("summary");
          const summaryText = summary ? compileHtmlToMarkdown(summary).trim() : "Details";
          const clone = element.cloneNode(true) as HTMLElement;
          const cloneSummary = clone.querySelector("summary");
          if (cloneSummary) cloneSummary.remove();
          const bodyText = compileHtmlToMarkdown(clone, listDepth).trim();
          markdown += `\n<details open><summary>${summaryText}</summary>\n\n${bodyText}\n\n</details>\n\n`;
        } else if (tag === "br") {
          markdown += "\n";
        } else if (tag === "div" || tag === "p") {
          markdown += `${compileHtmlToMarkdown(element, listDepth)}\n`;
        } else {
          markdown += compileHtmlToMarkdown(element, listDepth);
        }
      }
    }
    return markdown;
  };

  const handleTabSwitch = (tab: "visual" | "markdown") => {
    setActiveTab(tab);
    let md = "";
    if (tab === "markdown" && editorRef.current) {
      md = compileHtmlToMarkdown(editorRef.current);
      setMarkdownOutput(md.replace(/\n{3,}/g, '\n\n').trim());
    }
  };

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  return (
    <div className="app-wrapper">
      <div className={`sidebar-overlay ${isSidebarOpen ? "active" : ""}`} onClick={() => setIsSidebarOpen(false)} />
      <nav className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Table of Contents</span>
          <button className="icon-btn-flat" onClick={() => setIsSidebarOpen(false)}><X size={20} /></button>
        </div>
        <div className="sidebar-content">
          {headings.length === 0 ? (
            <div className="empty-state">Start typing headings to see them here</div>
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
        <div className="top-bar-solid">
          <div className="top-left">
            <button className="icon-btn" onClick={() => setIsSidebarOpen(true)}><Menu size={18} /></button>
            <div className="undo-redo-group">
              <button className="icon-btn-flat" onClick={() => executeCommand("undo")} title="Undo"><Undo size={18} /></button>
              <button className="icon-btn-flat" onClick={() => executeCommand("redo")} title="Redo"><Redo size={18} /></button>
            </div>
          </div>
          <div className="tab-switcher">
            <button onClick={() => handleTabSwitch("visual")} className={`tab-btn ${activeTab === "visual" ? "active" : ""}`}>Editor</button>
            <button onClick={() => handleTabSwitch("markdown")} className={`tab-btn ${activeTab === "markdown" ? "active" : ""}`}>Source</button>
          </div>
        </div>

        <div className="paper-wrapper">
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
              data-placeholder="Draft your brilliant ideas here..."
            />
          </div>
          
          <div className={`tab-content ${activeTab === "markdown" ? "active" : ""}`}>
            <pre className="markdown-preview">
              {markdownOutput || "No content generated yet."}
            </pre>
          </div>
        </div>

        <div className="bottom-info">
          <span className={charCount > MAX_CHARS ? "text-danger" : ""}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
          </span>
          {charCount > MAX_CHARS && <div className="limit-warning">Character limit exceeded!</div>}
        </div>

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
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h1>"); }}><Heading1 size={18} /> <span>Heading 1</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h2>"); }}><Heading2 size={18} /> <span>Heading 2</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h3>"); }}><Heading3 size={18} /> <span>Heading 3</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h4>"); }}><Heading4 size={18} /> <span>Heading 4</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h5>"); }}><Heading5 size={18} /> <span>Heading 5</span></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h6>"); }}><Heading6 size={18} /> <span>Heading 6</span></button>
                <div className="menu-divider" />
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<p>"); }}><Type size={18} /> <span>Paragraph</span></button>
              </div>
            )}

            <div className="smart-toolbar">
              <div className="toolbar-inner">
                <button onMouseDown={(e) => { e.preventDefault(); setIsHeadingMenuOpen(!isHeadingMenuOpen); }} className={`tool-btn ${isHeadingMenuOpen ? 'active' : ''}`} title="Heading"><Type size={18} /></button>
                
                <div className="divider" />

                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("bold"); }} className={`tool-btn ${activeFormats.bold ? "active" : ""}`} title="Bold"><Bold size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("italic"); }} className={`tool-btn ${activeFormats.italic ? "active" : ""}`} title="Italic"><Italic size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("underline"); }} className={`tool-btn ${activeFormats.underline ? "active" : ""}`} title="Underline"><Underline size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("strikeThrough"); }} className={`tool-btn ${activeFormats.strikeThrough ? "active" : ""}`} title="Strikethrough"><Strikethrough size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); removeFormat(); }} className="tool-btn" title="Clear Formatting"><Eraser size={18} /></button>
                
                <div className="divider" />
                
                <button onMouseDown={(e) => { e.preventDefault(); toggleCustomFormat("mark"); }} className="tool-btn" title="Toggle Highlight"><Highlighter size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); toggleCustomFormat("span", "tg-spoiler"); }} className="tool-btn" title="Toggle Spoiler"><EyeOff size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); openLinkModal(); }} className="tool-btn" title="Link"><LinkIcon size={18} /></button>

                <div className="divider" />
                
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyLeft"); }} className="tool-btn"><AlignLeft size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("insertUnorderedList"); }} className={`tool-btn ${activeFormats.ul ? "active" : ""}`} title="Bullet List"><List size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("insertOrderedList"); }} className={`tool-btn ${activeFormats.ol ? "active" : ""}`} title="Numbered List"><ListOrdered size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("indent"); }} className="tool-btn" title="Indent (Nested List)"><Indent size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("outdent"); }} className="tool-btn" title="Outdent"><Outdent size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<blockquote>"); }} className="tool-btn" title="Quote"><Quote size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsCodeModalOpen(true); }} className="tool-btn" title="Code Block"><Code size={18} /></button>

                <div className="divider" />

                <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsMediaModalOpen(true); }} className="tool-btn" title="Insert Media"><ImageIcon size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsTableModalOpen(true); }} className="tool-btn" title="Insert Table"><TableIcon size={18} /></button>
                <button onMouseDown={(e) => { e.preventDefault(); insertCollapsible(); }} className="tool-btn" title="Collapsible"><FolderKanban size={18} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Modal */}
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

      {/* Advanced Media Modal */}
      <div className={`modal-overlay ${isMediaModalOpen ? "active" : ""}`}>
        <div className="modal-box media-modal">
          <h2>Insert Rich Media</h2>
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

      {/* Link Modal */}
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

      {/* Code Modal */}
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