"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useWorkspaceId } from "@/app/workspace/components/WorkspaceContext";
import { useMultiFieldContentSync } from "@/lib/sync/useContentSync";
import { createEditorEventEmitter } from "@/lib/events";

const emitEvent = createEditorEventEmitter('ag-grid');
import { AgGridReact } from "ag-grid-react";
import {
  ColDef,
  GridReadyEvent,
  CellValueChangedEvent,
  SelectionChangedEvent,
  GridApi,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
} from "ag-grid-community";
import {
  Download,
  Plus,
  Trash2,
  RefreshCw,
  Filter,
  Search,
  LayoutGrid,
  FolderOpen,
  FileSpreadsheet,
} from "lucide-react";
import type { ComponentPreviewProps } from "@/components/playground/registry";
import { AssetBrowser, type AssetItem } from "@/components/shared/AssetBrowser";
import { componentEventBus } from "@/lib/events";

// Register AG Grid Community Modules
ModuleRegistry.registerModules([AllCommunityModule]);

// ============================================================
// Types
// ============================================================

type RowData = Record<string, unknown>;

interface DatasetMeta {
  filename?: string;
  format?: string;
  totalRows?: number;
  displayedRows?: number;
  truncated?: boolean;
  columnInfo?: Array<{ name: string; dtype: string }>;
}

// No default sample data — grid starts empty until agent populates it

// ============================================================
// Component
// ============================================================

export default function AGGridPreview({ onOutput }: ComponentPreviewProps) {
  const gridRef = useRef<AgGridReact>(null);

  const workspaceId = useWorkspaceId();

  const [rowData, setRowData] = useState<RowData[]>([]);
  const [selectedRows, setSelectedRows] = useState<RowData[]>([]);
  const [quickFilter, setQuickFilter] = useState("");
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [customColumns, setCustomColumns] = useState<ColDef[] | null>(null);
  const [datasetMeta, setDatasetMeta] = useState<DatasetMeta | null>(null);

  // Sync grid metadata to componentStore
  const syncGridState = useMultiFieldContentSync('ag-grid', 2000);
  useEffect(() => {
    syncGridState({
      rowCount: rowData.length,
      selectedRowIds: selectedRows.map((r) => String(r.id ?? '')),
    });
  }, [rowData.length, selectedRows, syncGridState]);

  // Report state to parent
  useEffect(() => {
    if (onOutput) {
      onOutput({
        totalRows: rowData.length,
        selectedRows: selectedRows.length,
        selectedData: selectedRows,
      });
    }
  }, [rowData, selectedRows, onOutput]);

  // Emit ready event on mount
  useEffect(() => {
    emitEvent({ type: 'ready' });
  }, []);

  // Listen for demo and agent directive events
  useEffect(() => {
    const handleLoadData = (e: CustomEvent<{ data: unknown[]; columns?: ColDef[] }>) => {
      const { data, columns } = e.detail;
      if (columns && columns.length > 0) setCustomColumns(columns);
      setRowData(data as RowData[]);
      emitEvent({ type: 'contentLoaded', payload: { action: 'load_data', result: { rowCount: data.length } } });
    };

    const handleAgentUpdateGrid = (e: CustomEvent<{ data: unknown[]; columns?: ColDef[]; title?: string; meta?: DatasetMeta }>) => {
      const { data, columns, meta } = e.detail;
      console.log('[AGGrid] Agent UPDATE_DATA_GRID:', data?.length, 'rows');
      if (columns && columns.length > 0) setCustomColumns(columns);
      setRowData(data as RowData[]);
      if (meta) setDatasetMeta(meta);
      emitEvent({ type: 'contentLoaded', payload: { action: 'update_data_grid', result: { rowCount: data.length } } });
    };

    window.addEventListener('demo:loadData', handleLoadData as EventListener);
    window.addEventListener('agent:directive:UPDATE_DATA_GRID', handleAgentUpdateGrid as EventListener);

    return () => {
      window.removeEventListener('demo:loadData', handleLoadData as EventListener);
      window.removeEventListener('agent:directive:UPDATE_DATA_GRID', handleAgentUpdateGrid as EventListener);
    };
  }, []);

  // Auto-generate column definitions from data
  const autoColumnDefs = useMemo<ColDef[]>(() => {
    if (customColumns) return customColumns;
    if (rowData.length === 0) return [];
    const keys = Object.keys(rowData[0]);
    return keys.map((key, i) => ({
      field: key,
      headerName: key,
      filter: typeof rowData[0][key] === 'number' ? 'agNumberColumnFilter' as const : 'agTextColumnFilter' as const,
      sortable: true,
      resizable: true,
      ...(i === 0 ? { checkboxSelection: true, headerCheckboxSelection: true, pinned: 'left' as const, width: 100 } : {}),
    }));
  }, [rowData, customColumns]);

  // Default column properties
  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
    }),
    []
  );

  // Grid ready handler
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // Selection changed handler
  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent) => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    },
    []
  );

  // Cell value changed handler
  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      console.log("Cell value changed:", event.data);
    },
    []
  );

  // Add new row
  const handleAddRow = useCallback(() => {
    if (rowData.length === 0) return;
    const keys = Object.keys(rowData[0]);
    const newRow: RowData = {};
    for (const key of keys) {
      newRow[key] = typeof rowData[0][key] === 'number' ? 0 : '';
    }
    newRow.id = Math.max(...rowData.map((r) => Number(r.id) || 0), 0) + 1;
    setRowData([newRow, ...rowData]);
  }, [rowData]);

  // Delete selected rows
  const handleDeleteSelected = useCallback(() => {
    if (selectedRows.length === 0) return;
    const selectedSet = new Set(selectedRows);
    setRowData(rowData.filter((r) => !selectedSet.has(r)));
    setSelectedRows([]);
  }, [selectedRows, rowData]);

  // Refresh data (clear current data)
  const handleRefresh = useCallback(() => {
    setRowData([]);
    setCustomColumns(null);
    setDatasetMeta(null);
    setSelectedRows([]);
  }, []);

  // Export to CSV
  const handleExport = useCallback(() => {
    if (gridApi) {
      const filename = datasetMeta?.filename
        ? datasetMeta.filename.replace(/\.[^.]+$/, '-export.csv')
        : 'data-export.csv';
      gridApi.exportDataAsCsv({ fileName: filename });
    }
  }, [gridApi, datasetMeta]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    if (gridApi) {
      gridApi.setFilterModel(null);
      setQuickFilter("");
    }
  }, [gridApi]);

  // Open asset from AssetBrowser
  const handleAssetSelect = useCallback((asset: AssetItem) => {
    componentEventBus.emit({
      component: 'ag-grid',
      type: 'assetOpen',
      payload: { result: { assetId: asset.id, assetType: asset.type, title: asset.title } },
      timestamp: Date.now(),
    });
  }, []);

  // Cmd+O keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        setShowAssetBrowser(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dynamic footer statistics — detect numeric columns and compute aggregates
  const numericStats = useMemo(() => {
    if (rowData.length === 0) return [];
    const keys = Object.keys(rowData[0]);
    return keys
      .filter((k) => typeof rowData[0][k] === 'number')
      .slice(0, 3)
      .map((k) => {
        const values = rowData.map((r) => Number(r[k]) || 0);
        const sum = values.reduce((s, v) => s + v, 0);
        return {
          name: k,
          avg: (sum / values.length).toFixed(2),
          sum: sum.toLocaleString(),
        };
      });
  }, [rowData]);

  // Custom light theme
  const customTheme = themeQuartz.withParams({
    backgroundColor: "#ffffff",
    foregroundColor: "#1c1917",
    headerBackgroundColor: "#f5f5f4",
    headerTextColor: "#57534e",
    oddRowBackgroundColor: "#fafaf9",
    rowHoverColor: "#f5f5f4",
    borderColor: "#e7e5e4",
    accentColor: "#4f46e5",
    cellHorizontalPaddingScale: 1,
  });

  return (
    <div className="flex flex-col h-full min-h-[500px] overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between h-10 px-3 py-2 bg-white border-b border-stone-200">
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-medium text-stone-800">
            {datasetMeta?.filename || "Data Grid"}
          </span>
          {datasetMeta?.filename && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" />
              {datasetMeta.format || 'csv'}
            </span>
          )}
          <span className="px-2 py-0.5 text-xs bg-stone-100 text-stone-600 rounded-full">
            {rowData.length}{datasetMeta?.truncated ? ` of ${datasetMeta.totalRows}` : ''} rows
          </span>
          {datasetMeta?.truncated && (
            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-600 rounded-full">
              Truncated
            </span>
          )}
          {selectedRows.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-600 rounded-full">
              {selectedRows.length} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Filter */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Quick filter..."
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm bg-stone-100 text-stone-800 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
            />
          </div>

          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200/60 transition-colors"
            title="Clear all filters"
          >
            <Filter className="h-3.5 w-3.5" />
            Clear
          </button>

          <div className="w-px h-5 bg-stone-200" />

          <button
            onClick={handleAddRow}
            disabled={rowData.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>

          <button
            onClick={handleDeleteSelected}
            disabled={selectedRows.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            onClick={handleExport}
            disabled={rowData.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>

          <div className="w-px h-5 bg-stone-200" />

          <button
            onClick={() => setShowAssetBrowser(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
            title="Open Asset (⌘O)"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open
          </button>
        </div>
      </div>

      {/* Grid or Empty State */}
      {rowData.length > 0 ? (
        <div className="flex-1">
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={autoColumnDefs}
            defaultColDef={defaultColDef}
            theme={customTheme}
            onGridReady={onGridReady}
            onSelectionChanged={onSelectionChanged}
            onCellValueChanged={onCellValueChanged}
            quickFilterText={quickFilter}
            rowSelection="multiple"
            pagination={true}
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 20, 50, 100]}
            animateRows={true}
            enableCellTextSelection={true}
            suppressRowClickSelection={true}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-3 py-20">
          <LayoutGrid className="h-12 w-12 text-stone-300" />
          <p className="text-sm font-medium text-stone-500">No data loaded</p>
          <p className="text-xs text-stone-400 max-w-xs text-center">
            Ask the agent to load a CSV, Excel, or other data file from /workspace/data/
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-stone-50 border-t border-stone-200 text-xs text-stone-500">
        <div className="flex items-center gap-4">
          <span>{rowData.length} rows</span>
          {numericStats.map((stat) => (
            <span key={stat.name}>
              Avg {stat.name}: {stat.avg}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span>AG Grid Community Edition</span>
          <span className="text-stone-300">|</span>
          <span>Double-click cells to edit</span>
        </div>
      </div>

      {/* Asset Browser */}
      <AssetBrowser
        isOpen={showAssetBrowser}
        onClose={() => setShowAssetBrowser(false)}
        onSelect={handleAssetSelect}
        title="Open Dataset"
      />
    </div>
  );
}
