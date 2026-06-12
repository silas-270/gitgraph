"use client";

import React, { useState, useEffect, useRef } from "react";
import { generateGitRepositoryZip } from "../../lib/gitGenerator";

const ROWS = 7;
const COLS = 53;

// Minimalist, standard GitHub Contribution Graph Colors
const COLORS = {
  0: "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
  1: "bg-[#9be9a8] dark:bg-[#0e4429] border-[#81d890] dark:border-[#0e4429]",
  2: "bg-[#40c463] dark:bg-[#006d32] border-[#36a654] dark:border-[#006d32]",
  3: "bg-[#30a14e] dark:bg-[#26a641] border-[#298a43] dark:border-[#26a641]",
  4: "bg-[#216e39] dark:bg-[#39d353] border-[#1b5a2f] dark:border-[#39d353]",
};

const FONT_3x5: Record<string, string[]> = {
  "A": ["010", "101", "111", "101", "101"],
  "B": ["110", "101", "110", "101", "110"],
  "C": ["011", "100", "100", "100", "011"],
  "D": ["110", "101", "101", "101", "110"],
  "E": ["111", "100", "110", "100", "111"],
  "F": ["111", "100", "110", "100", "100"],
  "G": ["011", "100", "101", "101", "011"],
  "H": ["101", "101", "111", "101", "101"],
  "I": ["111", "010", "010", "010", "111"],
  "J": ["001", "001", "001", "101", "010"],
  "K": ["101", "101", "110", "101", "101"],
  "L": ["100", "100", "100", "100", "111"],
  "M": ["10001", "11011", "10101", "10001", "10001"],
  "N": ["101", "111", "101", "101", "101"],
  "O": ["010", "101", "101", "101", "010"],
  "P": ["110", "101", "110", "100", "100"],
  "Q": ["010", "101", "101", "110", "011"],
  "R": ["110", "101", "110", "101", "101"],
  "S": ["011", "100", "010", "001", "110"],
  "T": ["111", "010", "010", "010", "010"],
  "U": ["101", "101", "101", "101", "111"],
  "V": ["101", "101", "101", "101", "010"],
  "W": ["10001", "10001", "10101", "10101", "01010"],
  "X": ["101", "101", "010", "101", "101"],
  "Y": ["101", "101", "010", "010", "010"],
  "Z": ["111", "001", "010", "100", "111"],
  "0": ["111", "101", "101", "101", "111"],
  "1": ["01", "11", "01", "01", "11"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  " ": ["0", "0", "0", "0", "0"],
  "!": ["1", "1", "1", "0", "1"],
  "?": ["111", "001", "010", "000", "010"],
  ".": ["0", "0", "0", "0", "1"],
  ",": ["0", "0", "0", "1", "1"],
  "-": ["00", "00", "11", "00", "00"],
  "+": ["000", "010", "111", "010", "000"],
  "_": ["000", "000", "000", "000", "111"]
};

type CanvasMode = "paint" | "select" | "text";
type Selection = { c1: number; r1: number; c2: number; r2: number } | null;

export default function GraphPainter() {
  const [grid, setGrid] = useState<number[][]>(() =>
    Array.from({ length: ROWS }, () => Array(COLS).fill(0))
  );

  // Tools & History
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("paint");
  const [activeTool, setActiveTool] = useState<number>(1);
  const [history, setHistory] = useState<number[][][]>([]);
  const [future, setFuture] = useState<number[][][]>([]);

  // Interaction State
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [isMovingSelection, setIsMovingSelection] = useState<boolean>(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Selection State
  const [selection, setSelection] = useState<Selection>(null);
  const [selectionBuffer, setSelectionBuffer] = useState<number[][] | null>(null);
  const [isFloating, setIsFloating] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ dc: number; dr: number }>({ dc: 0, dr: 0 });
  const [dragOrigin, setDragOrigin] = useState<{ col: number; row: number } | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [maxCommits, setMaxCommits] = useState("10");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [textCursor, setTextCursor] = useState<{ r: number; c: number } | null>(null);
  const [textBaseGrid, setTextBaseGrid] = useState<number[][] | null>(null);
  const [typedChars, setTypedChars] = useState<{ char: string; width: number; tool: number }[]>([]);

  // Load from LocalStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem("gitgraph_email");
    const savedAuthor = localStorage.getItem("gitgraph_author");
    const savedYear = localStorage.getItem("gitgraph_year");
    const savedMaxCommits = localStorage.getItem("gitgraph_max_commits");
    const savedGrid = localStorage.getItem("gitgraph_grid");

    if (savedEmail !== null) setEmail(savedEmail);
    if (savedAuthor !== null) setAuthorName(savedAuthor);
    if (savedYear !== null) setYear(savedYear);
    if (savedMaxCommits !== null) setMaxCommits(savedMaxCommits);
    if (savedGrid !== null) {
      try {
        const parsed = JSON.parse(savedGrid);
        if (Array.isArray(parsed) && parsed.length === ROWS && parsed.every(row => Array.isArray(row) && row.length === COLS)) {
          setGrid(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved grid", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("gitgraph_email", email);
    localStorage.setItem("gitgraph_author", authorName);
    localStorage.setItem("gitgraph_year", year);
    localStorage.setItem("gitgraph_max_commits", maxCommits);
    localStorage.setItem("gitgraph_grid", JSON.stringify(grid));
  }, [email, authorName, year, maxCommits, grid, isLoaded]);

  const pushHistory = (prevState: number[][]) => {
    setHistory((h) => [...h.slice(-49), prevState]);
    setFuture([]);
  };

  const handleUndo = () => {
    if (!history.length) return;
    commitSelection(false);
    setFuture((f) => [grid, ...f]);
    setGrid(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  const handleRedo = () => {
    if (!future.length) return;
    commitSelection(false);
    setHistory((h) => [...h, grid]);
    setGrid(future[0]);
    setFuture((f) => f.slice(1));
  };

  const commitTextInteraction = () => {
    setTextBaseGrid(null);
    setTypedChars([]);
  };

  const changeCanvasMode = (mode: CanvasMode) => {
    commitSelection();
    commitTextInteraction();
    setCanvasMode(mode);
    if (mode !== "text") {
      setTextCursor(null);
    }
  };

  const renderTextOnGrid = (
    baseGrid: number[][],
    startCursor: { r: number; c: number },
    chars: { char: string; width: number; tool: number }[]
  ): number[][] => {
    const newGrid = baseGrid.map((row) => [...row]);
    let currentCol = startCursor.c;
    
    for (const item of chars) {
      const charPattern = FONT_3x5[item.char];
      if (charPattern) {
        const charWidth = item.width;
        for (let r = 0; r < 5; r++) {
          const rowStr = charPattern[r];
          for (let c = 0; c < charWidth; c++) {
            const gridR = startCursor.r + r;
            const gridC = currentCol + c;
            if (gridR >= 0 && gridR < ROWS && gridC >= 0 && gridC < COLS) {
              const isNotInYear = isCellDisabled(gridR, gridC);
              const isBlockedCol = gridC === 0 || gridC === COLS - 1;
              if (!isNotInYear && !isBlockedCol && rowStr[c] === "1") {
                newGrid[gridR][gridC] = item.tool;
              }
            }
          }
        }
        currentCol += charWidth + 1;
      }
    }
    return newGrid;
  };

  // Keyboard Shortcuts for Undo/Redo & Text Mode Typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (showClearConfirm) {
          setShowClearConfirm(false);
        } else if (textCursor) {
          commitTextInteraction();
          setTextCursor(null);
        } else {
          commitSelection();
        }
      } else if (canvasMode === "text" && textCursor) {
        if (e.key === "Backspace") {
          e.preventDefault();
          if (typedChars.length > 0) {
            pushHistory(grid);
            const nextTypedChars = typedChars.slice(0, -1);
            
            // Calculate original starting column
            let startCol = textCursor.c;
            for (const item of typedChars) {
              startCol -= (item.width + 1);
            }
            
            const baseGrid = textBaseGrid || grid;
            const updatedGrid = renderTextOnGrid(baseGrid, { r: textCursor.r, c: startCol }, nextTypedChars);
            
            let newCursorCol = startCol;
            for (const item of nextTypedChars) {
              newCursorCol += (item.width + 1);
            }
            
            setGrid(updatedGrid);
            setTextCursor({ r: textCursor.r, c: newCursorCol });
            setTypedChars(nextTypedChars);
          }
        } else if (e.key.length === 1) {
          const char = e.key.toUpperCase();
          const charPattern = FONT_3x5[char];
          if (charPattern) {
            e.preventDefault();
            const charWidth = charPattern[0].length;
            
            if (textCursor.c + charWidth <= COLS - 1) {
              pushHistory(grid);
              
              // Ensure we have a base grid captured
              const baseGrid = textBaseGrid || grid;
              if (!textBaseGrid) {
                setTextBaseGrid(grid);
              }
              
              const newCharItem = { char, width: charWidth, tool: activeTool };
              const nextTypedChars = [...typedChars, newCharItem];
              
              // Calculate start column
              let startCol = textCursor.c;
              for (const item of typedChars) {
                startCol -= (item.width + 1);
              }
              
              const updatedGrid = renderTextOnGrid(baseGrid, { r: textCursor.r, c: startCol }, nextTypedChars);
              
              setGrid(updatedGrid);
              setTextCursor({ r: textCursor.r, c: textCursor.c + charWidth + 1 });
              setTypedChars(nextTypedChars);
            }
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [grid, history, future, selection, isFloating, selectionBuffer, showClearConfirm, canvasMode, textCursor, typedChars, textBaseGrid, activeTool]); 

  const parsedYear = parseInt(year) || new Date().getFullYear();
  const startDay = new Date(parsedYear, 0, 1).getDay();
  const isLeap = parsedYear % 400 === 0 || (parsedYear % 100 !== 0 && parsedYear % 4 === 0);
  const daysInYear = isLeap ? 366 : 365;

  const isCellDisabled = (rowIndex: number, colIndex: number) => {
    const dayIndex = colIndex * 7 + rowIndex - startDay;
    return dayIndex < 0 || dayIndex >= daysInYear;
  };

  const getStats = () => {
    let totalCommits = 0;
    let activeDays = 0;
    const maxCommitsVal = parseInt(maxCommits) || 10;
    
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = grid[r][c];
        if (val > 0 && !isCellDisabled(r, c)) {
          activeDays++;
          totalCommits += Math.round((val / 4) * maxCommitsVal);
        }
      }
    }
    
    return { totalCommits, activeDays };
  };

  const { totalCommits, activeDays } = getStats();

  const getCellCoordsFromEvent = (e: React.PointerEvent | PointerEvent, unbounded = false) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const STEP = 14 + 3; // CELL_SIZE + GAP
    const colIndex = Math.floor(x / STEP);
    const rowIndex = Math.floor(y / STEP);

    if (unbounded) {
      return { colIndex, rowIndex };
    }

    if (rowIndex >= 0 && rowIndex < ROWS && colIndex >= 0 && colIndex < COLS) {
      return { colIndex, rowIndex };
    }
    return null;
  };

  const paintCell = (r: number, c: number) => {
    const isNotInYear = isCellDisabled(r, c);
    const isBlockedCol = c === 0 || c === COLS - 1;
    if (!isNotInYear && !isBlockedCol) {
      setGrid((prev) => {
        if (prev[r][c] === activeTool) return prev;
        const newGrid = prev.map((row) => [...row]);
        newGrid[r][c] = activeTool;
        return newGrid;
      });
    }
  };

  const commitSelection = (recordHistory = true) => {
    if (!selection || !isFloating || !selectionBuffer) {
      setSelection(null);
      setSelectionBuffer(null);
      setIsFloating(false);
      return;
    }

    if (recordHistory) {
      pushHistory(grid);
    }

    setGrid((prev) => {
      const newGrid = prev.map((row) => [...row]);
      
      const rMin = Math.min(selection.r1, selection.r2);
      const rMax = Math.max(selection.r1, selection.r2);
      const cMin = Math.min(selection.c1, selection.c2);
      const cMax = Math.max(selection.c1, selection.c2);

      for (let i = 0; i <= rMax - rMin; i++) {
        for (let j = 0; j <= cMax - cMin; j++) {
          const targetR = rMin + i;
          const targetC = cMin + j;
          
          if (targetR >= 0 && targetR < ROWS && targetC >= 0 && targetC < COLS) {
            const isNotInYear = isCellDisabled(targetR, targetC);
            const isBlockedCol = targetC === 0 || targetC === COLS - 1;
            if (!isNotInYear && !isBlockedCol) {
              newGrid[targetR][targetC] = selectionBuffer[i][j];
            }
          }
        }
      }
      return newGrid;
    });

    setSelection(null);
    setSelectionBuffer(null);
    setIsFloating(false);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const coords = getCellCoordsFromEvent(e);
    if (!coords) return;
    const { colIndex: c, rowIndex: r } = coords;

    if (canvasMode === "paint") {
      commitSelection();
      pushHistory(grid);
      setIsDrawing(true);
      paintCell(r, c);
    } else if (canvasMode === "select") {
      const isInside = selection && 
                       c >= Math.min(selection.c1, selection.c2) && 
                       c <= Math.max(selection.c1, selection.c2) &&
                       r >= Math.min(selection.r1, selection.r2) && 
                       r <= Math.max(selection.r1, selection.r2);

      if (isInside && selection) {
        setIsMovingSelection(true);
        setDragOrigin({ col: c, row: r });
        setDragOffset({ dc: 0, dr: 0 });
        
        if (!isFloating) {
          // Tear off the selection into a floating buffer
          const cMin = Math.min(selection.c1, selection.c2);
          const cMax = Math.max(selection.c1, selection.c2);
          const rMin = Math.min(selection.r1, selection.r2);
          const rMax = Math.max(selection.r1, selection.r2);
          
          const buf: number[][] = [];
          for (let row = rMin; row <= rMax; row++) {
            const bufRow: number[] = [];
            for (let col = cMin; col <= cMax; col++) {
              if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
                bufRow.push(grid[row][col]);
              } else {
                bufRow.push(0);
              }
            }
            buf.push(bufRow);
          }
          setSelectionBuffer(buf);
          setIsFloating(true);

          pushHistory(grid);
          setGrid((prev) => {
            const newGrid = prev.map((row) => [...row]);
            for (let row = rMin; row <= rMax; row++) {
              for (let col = cMin; col <= cMax; col++) {
                if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
                  newGrid[row][col] = 0;
                }
              }
            }
            return newGrid;
          });
        }
      } else {
        commitSelection();
        setIsSelecting(true);
        setSelection({ c1: c, r1: r, c2: c, r2: r });
      }
    } else if (canvasMode === "text") {
      commitSelection();
      commitTextInteraction();
      setTextCursor({ r: 1, c });
      setTextBaseGrid(grid);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const coords = getCellCoordsFromEvent(e);
    if (!coords) return;
    const { colIndex: c, rowIndex: r } = coords;

    if (canvasMode === "paint" && isDrawing) {
      paintCell(r, c);
    } else if (canvasMode === "select" && isSelecting && selection) {
      setSelection((prev) => prev ? { ...prev, c2: c, r2: r } : null);
    }
  };

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (isMovingSelection && dragOrigin) {
        const coords = getCellCoordsFromEvent(e, true); // unbounded coordinates
        if (coords) {
          setDragOffset({ dc: coords.colIndex - dragOrigin.col, dr: coords.rowIndex - dragOrigin.row });
        }
      }
    };

    const handleGlobalPointerUp = () => {
      if (canvasMode === "paint") {
        setIsDrawing(false);
      } else if (canvasMode === "select") {
        setIsSelecting(false);
        
        if (isMovingSelection && selection) {
          setIsMovingSelection(false);
          const cMin = Math.min(selection.c1, selection.c2);
          const rMin = Math.min(selection.r1, selection.r2);
          const cMax = Math.max(selection.c1, selection.c2);
          const rMax = Math.max(selection.r1, selection.r2);

          // Update selection bounds (it stays floating)
          setSelection({
            c1: cMin + dragOffset.dc,
            r1: rMin + dragOffset.dr,
            c2: cMax + dragOffset.dc,
            r2: rMax + dragOffset.dr,
          });
          setDragOffset({ dc: 0, dr: 0 });
          setDragOrigin(null);
        }
      }
    };

    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, [canvasMode, isDrawing, isSelecting, isMovingSelection, selection, dragOffset, dragOrigin]);

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    commitSelection();
    commitTextInteraction();
    pushHistory(grid);
    setGrid(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
    setShowClearConfirm(false);
  };

  const handleExport = () => {
    if (isFloating) commitSelection(false);
    commitTextInteraction();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(grid));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `github-graph-design-${year || 2026}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!Array.isArray(parsed) || parsed.length !== ROWS) {
          throw new Error("Invalid number of rows. Expected 7.");
        }
        
        const newGrid = [];
        for (let i = 0; i < ROWS; i++) {
          if (!Array.isArray(parsed[i]) || parsed[i].length !== COLS) {
            throw new Error(`Invalid number of columns in row ${i}. Expected 53.`);
          }
          
          const newRow = [];
          for (let j = 0; j < COLS; j++) {
            const val = Number(parsed[i][j]);
            if (isNaN(val) || val < 0 || val > 4) {
              throw new Error(`Invalid value at row ${i}, col ${j}. Must be 0-4.`);
            }
            newRow.push(val);
          }
          newGrid.push(newRow);
        }
        
        commitSelection();
        commitTextInteraction();
        pushHistory(grid);
        setGrid(newGrid);
      } catch (err: any) {
        alert(`Import failed: ${err.message}`);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleDownloadRepo = async () => {
    if (!email) {
      alert("Please enter a GitHub Email before generating the repository.");
      return;
    }

    setIsGenerating(true);
    if (isFloating) commitSelection(false);
    commitTextInteraction();

    try {
      const zipBlob = await generateGitRepositoryZip(
        grid,
        parsedYear,
        email,
        authorName,
        parseInt(maxCommits) || 10
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `github-graph-${parsedYear}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Error generating repository: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFlip = (direction: 'H' | 'V') => {
    if (!selection) return;

    const cMin = Math.min(selection.c1, selection.c2);
    const cMax = Math.max(selection.c1, selection.c2);
    const rMin = Math.min(selection.r1, selection.r2);
    const rMax = Math.max(selection.r1, selection.r2);

    let targetBuf = selectionBuffer;

    if (!isFloating || !targetBuf) {
      // Tear it off if it isn't already floating
      pushHistory(grid);
      const buf: number[][] = [];
      for (let row = rMin; row <= rMax; row++) {
        const bufRow: number[] = [];
        for (let col = cMin; col <= cMax; col++) {
          if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
            bufRow.push(grid[row][col]);
          } else {
            bufRow.push(0);
          }
        }
        buf.push(bufRow);
      }
      targetBuf = buf;
      
      setGrid((prev) => {
        const newGrid = prev.map((row) => [...row]);
        for (let row = rMin; row <= rMax; row++) {
          for (let col = cMin; col <= cMax; col++) {
            if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
              newGrid[row][col] = 0;
            }
          }
        }
        return newGrid;
      });
      setIsFloating(true);
    }

    const newBuf: number[][] = [];
    if (direction === 'H') {
      for (let i = 0; i < targetBuf.length; i++) {
        const row = [...targetBuf[i]];
        row.reverse();
        newBuf.push(row);
      }
    } else {
      for (let i = 0; i < targetBuf.length; i++) {
        newBuf.push([...targetBuf[i]]);
      }
      newBuf.reverse();
    }
    
    setSelectionBuffer(newBuf);
  };

  const getRenderCell = (r: number, c: number) => {
    let val = grid[r][c];
    let isSelBorder = false;

    if (selection) {
      const cMin = Math.min(selection.c1, selection.c2);
      const cMax = Math.max(selection.c1, selection.c2);
      const rMin = Math.min(selection.r1, selection.r2);
      const rMax = Math.max(selection.r1, selection.r2);

      if (isFloating && selectionBuffer) {
        // Destination area
        const destCMin = cMin + dragOffset.dc;
        const destCMax = cMax + dragOffset.dc;
        const destRMin = rMin + dragOffset.dr;
        const destRMax = rMax + dragOffset.dr;

        if (c >= destCMin && c <= destCMax && r >= destRMin && r <= destRMax) {
          isSelBorder = c === destCMin || c === destCMax || r === destRMin || r === destRMax;
          const bufR = r - destRMin;
          const bufC = c - destCMin;
          
          if (bufR >= 0 && bufR <= rMax - rMin && bufC >= 0 && bufC <= cMax - cMin) {
            val = selectionBuffer[bufR][bufC];
          }
        }
      } else {
        // Normal selection box (not detached yet)
        if (c >= cMin && c <= cMax && r >= rMin && r <= rMax) {
          isSelBorder = c === cMin || c === cMax || r === rMin || r === rMax;
        }
      }
    }

    return { val, isSelBorder };
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 md:p-8 space-y-6 text-zinc-900 dark:text-zinc-100">
      
      {/* Top Section: Inputs & Controls */}
      <div className="w-full bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div>
            <h1 className="text-xl font-medium tracking-tight">GitHub Graph Painter</h1>
            <p className="text-xs text-zinc-500 mt-1">Design your commit timeline and download a ready-to-push repository.</p>
          </div>
        </div>
        
        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">GitHub Email</label>
            <div className="relative flex items-center">
              <div className="absolute left-3 pointer-events-none text-zinc-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </div>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 pr-3 py-2 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>
          
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Author Name</label>
            <div className="relative flex items-center">
              <div className="absolute left-3 pointer-events-none text-zinc-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <input 
                type="text" 
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="pl-9 pr-3 py-2 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                placeholder="GitGraph User"
              />
            </div>
          </div>
          
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Target Year</label>
            <div className="relative flex items-center">
              <div className="absolute left-3 pointer-events-none text-zinc-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              </div>
              <input 
                type="number" 
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="pl-9 pr-3 py-2 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                placeholder="2026"
              />
            </div>
          </div>
          
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Max Commits</label>
            <div className="relative flex items-center">
              <div className="absolute left-3 pointer-events-none text-zinc-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <input 
                type="number" 
                value={maxCommits}
                onChange={(e) => setMaxCommits(e.target.value)}
                className="pl-9 pr-3 py-2 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                placeholder="10"
                min="1"
              />
            </div>
          </div>
        </div>
        
        {/* Buttons Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="flex gap-2.5">
            <button 
              onClick={handleImportClick}
              className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-md shadow-sm active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5 text-zinc-700 dark:text-zinc-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import JSON
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileImport} 
              accept=".json" 
              className="hidden" 
            />
            <button 
              onClick={handleExport}
              className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-md shadow-sm active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5 text-zinc-700 dark:text-zinc-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export JSON
            </button>
          </div>
          
          <div className="flex gap-2.5">
            <button 
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              Clear
            </button>
            <button 
              onClick={handleDownloadRepo}
              disabled={isGenerating}
              className="flex-1 sm:flex-initial px-5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white rounded-md shadow-sm active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Building...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Repo
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar & Canvas Container */}
      <div className="w-full bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm overflow-x-auto relative">
        <div className="min-w-fit flex flex-col items-stretch w-full">
          
          <div className="flex w-full items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              
              <button 
                onClick={() => changeCanvasMode("paint")}
                title="Paint Tool"
                className={`p-1.5 rounded-md border transition-colors flex items-center justify-center ${canvasMode === "paint" ? 'border-zinc-400 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'border-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
              </button>
              
              <button 
                onClick={() => changeCanvasMode("select")}
                title="Select Tool"
                className={`p-1.5 rounded-md border transition-colors flex items-center justify-center ${canvasMode === "select" ? 'border-zinc-400 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'border-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h6v2H5v4H3V3z"/><path d="M21 3h-6v2h4v4h2V3z"/><path d="M3 21h6v-2H5v-4H3v6z"/><path d="M21 21h-6v-2h4v-4h2v6z"/></svg>
              </button>
              
              <button 
                onClick={() => changeCanvasMode("text")}
                title="Text Tool"
                className={`p-1.5 rounded-md border transition-colors flex items-center justify-center ${canvasMode === "text" ? 'border-zinc-400 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'border-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
              </button>

              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
              
              <button 
                onClick={handleUndo}
                disabled={history.length === 0}
                className="p-1.5 rounded-md border border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
              </button>
              <button 
                onClick={handleRedo}
                disabled={future.length === 0}
                className="p-1.5 rounded-md border border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Y)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
              </button>

              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
              
              {canvasMode === "paint" || canvasMode === "text" ? (
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setActiveTool(0)}
                    className={`p-1.5 rounded-md border transition-colors flex items-center justify-center ${activeTool === 0 ? 'border-zinc-400 bg-zinc-100 dark:bg-zinc-800' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                    title="Eraser (0)"
                  >
                    <div className="w-4 h-4 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                        <path d="M22 21H7" />
                        <path d="m13.3 9 5.5 5.5" />
                      </svg>
                    </div>
                  </button>
                  
                  {[1, 2, 3, 4].map((level) => (
                    <button
                      key={level}
                      onClick={() => setActiveTool(level)}
                      className={`p-1.5 rounded-md border transition-colors ${activeTool === level ? 'border-zinc-400 bg-zinc-100 dark:bg-zinc-800' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                      title={`Level ${level}`}
                    >
                      <div className={`w-4 h-4 rounded-sm border ${COLORS[level as keyof typeof COLORS]}`}></div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`flex items-center space-x-2 transition-opacity duration-200 ${selection ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                   <button onClick={() => handleFlip('H')} title="Flip Horizontally" className="p-1.5 rounded-md border border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="M8 7l-5 5 5 5"/><path d="M16 7l5 5-5 5"/></svg>
                   </button>
                   <button onClick={() => handleFlip('V')} title="Flip Vertically" className="p-1.5 rounded-md border border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M7 8l5-5 5 5"/><path d="M7 16l5 5 5-5"/></svg>
                   </button>
                </div>
              )}
            </div>
            
            <div className="text-xs text-zinc-500 font-medium select-none">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{totalCommits}</span> Commits &bull; <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeDays}</span> aktive Tage
            </div>
          </div>

          <div className="w-full flex justify-center mb-4">
            <div 
              ref={gridRef}
              className="inline-grid gap-[3px] touch-none select-none cursor-crosshair relative z-10"
              style={{ gridTemplateColumns: `repeat(${COLS}, 14px)`, gridTemplateRows: `repeat(${ROWS}, 14px)` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onDragStart={(e) => e.preventDefault()}
            >
              {grid.map((row, rowIndex) => 
                row.map((_, colIndex) => {
                  const isNotInYear = isCellDisabled(rowIndex, colIndex);
                  const isBlockedCol = colIndex === 0 || colIndex === COLS - 1;
                  const { val, isSelBorder } = getRenderCell(rowIndex, colIndex);
                  
                  let baseClasses = "w-[14px] h-[14px] rounded-[2px] relative ";

                  if (isNotInYear) {
                    return <div key={`${rowIndex}-${colIndex}`} className="w-[14px] h-[14px]" />;
                  }

                  if (isBlockedCol) {
                    return (
                      <div 
                        key={`${rowIndex}-${colIndex}`} 
                        className={`${baseClasses} bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 opacity-60`}
                      />
                    );
                  }

                  let extraStyles = "";
                  if (isSelBorder) {
                    extraStyles += " ring-[1.5px] ring-red-500 z-20";
                  } else if (canvasMode === "text" && textCursor && textCursor.c === colIndex && rowIndex >= textCursor.r && rowIndex < textCursor.r + 5) {
                    extraStyles += " ring-[1.5px] ring-emerald-500 z-20 animate-pulse";
                  } else if (canvasMode === "paint") {
                    extraStyles += " z-10 hover:ring-[1.5px] hover:ring-zinc-400";
                  } else if (canvasMode === "text") {
                    extraStyles += " z-10 hover:ring-[1.5px] hover:ring-emerald-400/50";
                  }

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`${baseClasses} border ${COLORS[val as keyof typeof COLORS]} ${extraStyles}`}
                    />
                  );
                })
              )}
            </div>
          </div>

          
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row w-full justify-between items-start sm:items-center text-xs text-zinc-500 gap-3">
            <div>
              {canvasMode === "paint" && "Click and drag to paint the grid"}
              {canvasMode === "select" && "Click and drag to select and move the grid"}
              {canvasMode === "text" && (
                <span>
                  Klicke auf das Gitter, um einen Cursor zu setzen, und tippe los. Mit <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[10px]">Backspace</kbd> löschen.
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <div key={`legend-${level}`} className={`w-[12px] h-[12px] rounded-[2px] border ${COLORS[level as keyof typeof COLORS]}`} />
              ))}
              <span>More</span>
            </div>
          </div>

        </div>
      </div>
      
      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-200">
          <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-sm w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              Graph zurücksetzen?
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2.5">
              Bist du sicher, dass du das gesamte Raster löschen möchtest? Das kann mit <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs">Strg+Z</kbd> rückgängig gemacht werden.
            </p>
            <div className="flex justify-end gap-2.5 mt-6">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-md transition-colors active:scale-95 duration-150"
              >
                Abbrechen
              </button>
              <button 
                onClick={confirmClear}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors active:scale-95 duration-150 shadow-sm"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
