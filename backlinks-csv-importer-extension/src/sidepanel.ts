import { parseCSV } from './csv-parser';
import { mergeAndSave, loadRecords, clearRecords, saveCommentStatuses, loadCommentStatuses } from './storage';
import { BacklinkRecord, ImportResult, CommentStatus, CommentStatusMap, CleansingStats, COMMENT_STATUS_LABELS } from './types';
import { applyStaticFilter } from './static-rule-engine';
import { fetchAndAnalyze } from './page-analyzer';
import { resolveStatus } from './status-resolver';
import { executeWithRateLimit } from './rate-limiter';
import { initTemplateManager } from './link-template';
import { initAutoComment, runAutoComment } from './auto-comment';
import { AVAILABLE_MODELS, AVAILABLE_VL_MODELS, DEFAULT_MODEL, DEFAULT_CAPTCHA_MODEL } from './ai-comment-generator';
import { OperationController, CancelledError } from './operation-controller';

// --- State ---
let currentRecords: BacklinkRecord[] = [];
let currentSortColumn = 'pageAS';
let currentSortOrder: 'asc' | 'desc' = 'desc';
let currentCommentStatuses: CommentStatusMap = {};
let currentFilterStatus: CommentStatus | 'all' = 'all';

// --- Operation Controllers ---
const cleanseController = new OperationController();
const autoCommentController = new OperationController();

// --- DOM helpers ---
function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

// --- Sort helpers ---
type SortColumn = 'pageAS' | 'sourceUrl' | 'linkType' | 'firstSeenDate' | 'lastSeenDate';

function getColumnValue(record: BacklinkRecord, column: SortColumn): string | number {
  switch (column) {
    case 'pageAS': return record.pageAS;
    case 'sourceUrl': return record.sourcePageInfo.url;
    case 'linkType': return record.anchorInfo.linkType ?? '';
    case 'firstSeenDate': return record.firstSeenDate;
    case 'lastSeenDate': return record.lastSeenDate;
  }
}

function compareValues(a: string | number, b: string | number, order: 'asc' | 'desc'): number {
  let result: number;
  if (typeof a === 'number' && typeof b === 'number') {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b));
  }
  return order === 'asc' ? result : -result;
}

export function sortRecords(records: BacklinkRecord[], column: string, order: 'asc' | 'desc'): BacklinkRecord[] {
  const col = column as SortColumn;
  return [...records].sort((a, b) =>
    compareValues(getColumnValue(a, col), getColumnValue(b, col), order)
  );
}

// --- Render functions ---

/**
 * Render the backlink records table.
 * Sorts records by the specified column/order, clears existing rows,
 * and creates new tr/td elements for each record.
 * Updates sort indicator on the active column header.
 */
export function renderTable(records: BacklinkRecord[], sortColumn: string, sortOrder: 'asc' | 'desc'): void {
  const tbody = document.querySelector('#data-table tbody')!;
  tbody.innerHTML = '';

  const sorted = sortRecords(records, sortColumn, sortOrder);

  for (const record of sorted) {
    const tr = document.createElement('tr');

    const cells = [
      String(record.pageAS),
      record.sourcePageInfo.url,
      formatLinkType(record),
      record.firstSeenDate,
      record.lastSeenDate,
    ];

    for (const text of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  // Update sort indicators on column headers
  const headers = document.querySelectorAll('#data-table thead th[data-column]');
  for (const th of headers) {
    const col = (th as HTMLElement).dataset.column;
    if (col === sortColumn) {
      (th as HTMLElement).dataset.sort = sortOrder;
    } else {
      delete (th as HTMLElement).dataset.sort;
    }
  }
}

/**
 * Render the backlink records table with an additional "评论状态" column.
 * Reads from module-level state: currentRecords, currentCommentStatuses,
 * currentSortColumn, currentSortOrder, currentFilterStatus.
 * Filters records by currentFilterStatus, sorts them, and renders with status badges.
 */
function renderTableWithStatus(): void {
  const tbody = document.querySelector('#data-table tbody')!;
  tbody.innerHTML = '';

  const sorted = sortRecords(currentRecords, currentSortColumn, currentSortOrder);

  // Filter by currentFilterStatus
  const filtered = currentFilterStatus === 'all'
    ? sorted
    : sorted.filter(record => currentCommentStatuses[record.sourcePageInfo.url] === currentFilterStatus);

  for (const record of filtered) {
    const tr = document.createElement('tr');

    // Page AS
    const asTd = document.createElement('td');
    asTd.textContent = String(record.pageAS);
    tr.appendChild(asTd);

    // URL cell with copy-on-click and full tooltip
    const urlTd = document.createElement('td');
    urlTd.className = 'url-cell';
    urlTd.title = record.sourcePageInfo.url;
    const urlSpan = document.createElement('span');
    urlSpan.className = 'url-text';
    urlSpan.textContent = record.sourcePageInfo.url;
    urlTd.appendChild(urlSpan);
    const openIcon = document.createElement('span');
    openIcon.className = 'open-icon';
    openIcon.textContent = '↗';
    openIcon.title = '在新标签页打开';
    openIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(record.sourcePageInfo.url, '_blank');
    });
    urlTd.appendChild(openIcon);
    const copyIcon = document.createElement('span');
    copyIcon.className = 'copy-icon';
    copyIcon.textContent = '📋';
    urlTd.appendChild(copyIcon);
    urlTd.addEventListener('click', () => {
      navigator.clipboard.writeText(record.sourcePageInfo.url).then(() => {
        copyIcon.textContent = '✅';
        setTimeout(() => { copyIcon.textContent = '📋'; }, 1000);
      });
    });
    tr.appendChild(urlTd);

    // Remaining columns
    for (const text of [formatLinkType(record), record.firstSeenDate, record.lastSeenDate]) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }

    // Add "评论状态" column
    const statusTd = document.createElement('td');
    const status = currentCommentStatuses[record.sourcePageInfo.url];
    if (status) {
      const span = document.createElement('span');
      span.className = 'status-badge';
      span.dataset.status = status;
      span.dataset.url = record.sourcePageInfo.url;
      span.textContent = COMMENT_STATUS_LABELS[status];
      // Only allow manual change for non-filtered statuses
      if (status !== 'filtered_out') {
        span.addEventListener('click', handleStatusChange);
      }
      statusTd.appendChild(span);
    }
    tr.appendChild(statusTd);

    tbody.appendChild(tr);
  }

  // Update sort indicators on column headers
  const headers = document.querySelectorAll('#data-table thead th[data-column]');
  for (const th of headers) {
    const col = (th as HTMLElement).dataset.column;
    if (col === currentSortColumn) {
      (th as HTMLElement).dataset.sort = currentSortOrder;
    } else {
      delete (th as HTMLElement).dataset.sort;
    }
  }
}
/**
 * Bind click event listeners to status filter buttons.
 * When a filter button is clicked:
 * - Update currentFilterStatus
 * - Toggle .active class
 * - Re-render the table
 */
function renderStatusFilter(): void {
  const buttons = document.querySelectorAll('#status-filter-section .status-filter button');
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const filterValue = (btn as HTMLElement).dataset.filter as CommentStatus | 'all';
      currentFilterStatus = filterValue;

      // Update active class
      for (const b of buttons) {
        b.classList.remove('active');
      }
      btn.classList.add('active');

      renderTableWithStatus();
    });
  }
}

/**
 * Handle clicking a status badge to show a dropdown for manual status change.
 * Creates a dropdown with commentable/login_required/uncertain options.
 * On selection: updates currentCommentStatuses, persists to storage, re-renders table.
 */
function handleStatusChange(event: Event): void {
  const badge = event.currentTarget as HTMLElement;
  const url = badge.dataset.url;
  if (!url) return;

  // Remove any existing dropdown
  removeStatusDropdown();

  const dropdown = document.createElement('div');
  dropdown.className = 'status-dropdown';

  const options: Array<{ status: CommentStatus; label: string }> = [
    { status: 'commentable', label: '✅ 可评论' },
    { status: 'login_required', label: '❌ 需登录' },
    { status: 'uncertain', label: '⚠️ 不确定' },
  ];

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opt.label;
    btn.addEventListener('click', async () => {
      currentCommentStatuses[url] = opt.status;
      await saveCommentStatuses(currentCommentStatuses);
      removeStatusDropdown();
      renderTableWithStatus();
      updateCleanseSummary();
    });
    dropdown.appendChild(btn);
  }

  // Position dropdown near the badge
  const rect = badge.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + window.scrollY}px`;
  dropdown.style.left = `${rect.left + window.scrollX}px`;
  document.body.appendChild(dropdown);

  // Close dropdown when clicking outside
  setTimeout(() => {
    document.addEventListener('click', closeDropdownOnOutsideClick);
  }, 0);
}

/**
 * Remove any open status dropdown from the DOM.
 */
function removeStatusDropdown(): void {
  const existing = document.querySelector('.status-dropdown');
  if (existing) existing.remove();
  document.removeEventListener('click', closeDropdownOnOutsideClick);
}

/**
 * Close dropdown when clicking outside of it.
 */
function closeDropdownOnOutsideClick(event: Event): void {
  const dropdown = document.querySelector('.status-dropdown');
  if (dropdown && !dropdown.contains(event.target as Node)) {
    removeStatusDropdown();
  }
}

/**
 * Recompute and update cleanse summary stats from currentCommentStatuses.
 */
function updateCleanseSummary(): void {
  const stats: CleansingStats = { commentable: 0, loginRequired: 0, uncertain: 0, filteredOut: 0 };
  for (const status of Object.values(currentCommentStatuses)) {
    switch (status) {
      case 'commentable': stats.commentable++; break;
      case 'login_required': stats.loginRequired++; break;
      case 'uncertain': stats.uncertain++; break;
      case 'filtered_out': stats.filteredOut++; break;
    }
  }
  $('stat-commentable').textContent = String(stats.commentable);
  $('stat-login-required').textContent = String(stats.loginRequired);
  $('stat-uncertain').textContent = String(stats.uncertain);
  $('stat-filtered-out').textContent = String(stats.filteredOut);
}



/**
 * Format link type + attributes for display.
 * e.g. "文本 | Nofollow | UGC"
 */
function formatLinkType(record: BacklinkRecord): string {
  const parts: string[] = [];
  if (record.anchorInfo.linkType) {
    parts.push(record.anchorInfo.linkType);
  }
  parts.push(...record.anchorInfo.attributes);
  return parts.join(' | ');
}

/**
 * Render the import summary statistics.
 */
function renderSummary(result: ImportResult): void {
  const section = $('summary-section');
  $('stat-total').textContent = String(result.totalRows);
  $('stat-success').textContent = String(result.successCount);
  $('stat-duplicates').textContent = String(result.duplicateCount);
  $('stat-failed').textContent = String(result.failedCount);
  section.hidden = false;
}

// --- Import handling ---

/**
 * Handle CSV file import.
 * Reads file → parses CSV → merges & deduplicates → saves → renders UI.
 */
async function handleImport(file: File): Promise<void> {
  const loading = $('loading-indicator');
  loading.hidden = false;

  try {
    const content = await readFileAsText(file);
    const parseResult = parseCSV(content);

    if (parseResult.records.length === 0 && parseResult.failedRows === parseResult.totalRows && parseResult.totalRows > 0) {
      alert('请选择有效的 CSV 文件');
      loading.hidden = true;
      return;
    }

    const deduplicationResult = await mergeAndSave(parseResult.records);

    // Build import result stats
    const importResult: ImportResult = {
      totalRows: parseResult.totalRows,
      successCount: parseResult.records.length,
      duplicateCount: deduplicationResult.removedCount,
      failedCount: parseResult.failedRows,
    };

    // Update state and render
    currentRecords = deduplicationResult.records;
    renderSummary(importResult);
    renderTableWithStatus();

    // Show cleanse button if there are records
    $('cleanse-btn').hidden = currentRecords.length === 0;
  } catch (error) {
    alert('请选择有效的 CSV 文件');
  } finally {
    loading.hidden = true;
  }
}

/**
 * Read a File object as text using FileReader.
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

// --- Cleanse UI state management ---

/**
 * Update cleanse button and cancel button states based on controller state.
 * - idle: show original "清洗 URL" button, hide cancel
 * - running: show "暂停" button, show cancel
 * - paused: show "继续" button, show cancel
 */
function updateCleanseButtonState(): void {
  const cleanseBtn = $('cleanse-btn') as HTMLButtonElement;
  const cancelBtn = $('cleanse-cancel-btn') as HTMLButtonElement;
  const progressBar = $('cleanse-progress-bar');
  const statusText = $('cleanse-status-text');

  switch (cleanseController.state) {
    case 'running':
      cleanseBtn.textContent = '暂停';
      cleanseBtn.disabled = false;
      cancelBtn.hidden = false;
      statusText.textContent = '正在清洗...';
      statusText.className = '';
      progressBar.classList.remove('paused');
      break;
    case 'paused':
      cleanseBtn.textContent = '继续';
      cleanseBtn.disabled = false;
      cancelBtn.hidden = false;
      statusText.textContent = '已暂停';
      statusText.className = 'status-paused';
      progressBar.classList.add('paused');
      break;
    default:
      cleanseBtn.textContent = '清洗 URL';
      cleanseBtn.disabled = false;
      cancelBtn.hidden = true;
      statusText.textContent = '';
      statusText.className = '';
      progressBar.classList.remove('paused');
      break;
  }
}

/**
 * Reset cleanse UI to idle state after a delay.
 */
function resetCleanseUI(delayMs = 3000): void {
  setTimeout(() => {
    const cleanseBtn = $('cleanse-btn') as HTMLButtonElement;
    const cancelBtn = $('cleanse-cancel-btn') as HTMLButtonElement;
    const statusText = $('cleanse-status-text');
    const progressBar = $('cleanse-progress-bar');

    cleanseBtn.textContent = '清洗 URL';
    cleanseBtn.disabled = false;
    cancelBtn.hidden = true;
    statusText.textContent = '';
    statusText.className = '';
    progressBar.classList.remove('paused');
  }, delayMs);
}

// --- Cleanse handling ---

/**
 * Handle "清洗 URL" button click.
 * 1. Start controller, show progress
 * 2. Apply static filter
 * 3. Rate-limited fetch + analyze for pending records (with controller)
 * 4. Save results, update UI
 * 5. Show cleanse summary stats
 * Supports pause/resume/cancel via cleanseController.
 */
async function handleCleanse(): Promise<void> {
  const cleanseBtn = $('cleanse-btn') as HTMLButtonElement;
  const progressSection = $('cleanse-progress');
  const progressBar = $('cleanse-progress-bar');
  const progressText = $('cleanse-progress-text');

  cleanseController.start();
  updateCleanseButtonState();
  progressSection.hidden = false;

  try {
    // Step 1: Static rule pre-filter
    const { filtered, pending } = applyStaticFilter(currentRecords);
    const total = filtered.length + pending.length;

    // Step 2: Initialize CommentStatusMap — filtered records get 'filtered_out'
    const statuses: CommentStatusMap = {};
    for (const record of filtered) {
      statuses[record.sourcePageInfo.url] = 'filtered_out';
    }

    // Step 3: Build tasks for pending records
    const baseCompleted = filtered.length;

    // Update progress for already-filtered records
    const progressPercent = total > 0 ? (baseCompleted / total) * 100 : 0;
    progressBar.style.width = `${progressPercent}%`;
    progressText.textContent = `已检查 ${baseCompleted} / ${total}`;

    const tasks = pending.map((record) => {
      return async () => {
        try {
          const analysisResult = await fetchAndAnalyze(record.sourcePageInfo.url);
          return { url: record.sourcePageInfo.url, status: resolveStatus(analysisResult) };
        } catch {
          return { url: record.sourcePageInfo.url, status: 'uncertain' as CommentStatus };
        }
      };
    });

    // Step 4: Execute with rate limiting (pass controller for pause/cancel)
    const onProgress = (completed: number, _total: number) => {
      const totalCompleted = baseCompleted + completed;
      const pct = total > 0 ? (totalCompleted / total) * 100 : 100;
      progressBar.style.width = `${pct}%`;
      progressText.textContent = `已检查 ${totalCompleted} / ${total}`;
    };

    const results = await executeWithRateLimit(tasks, {
      maxConcurrent: 3,
      delayMs: 500,
      timeoutMs: 10000,
    }, onProgress, cleanseController);

    // Step 5: Collect statuses from results
    for (const result of results) {
      statuses[result.url] = result.status;
    }

    // Step 6: Save and update state
    await saveCommentStatuses(statuses);
    currentCommentStatuses = statuses;

    // Step 7: Display cleanse summary stats
    updateCleanseSummary();
    $('cleanse-summary-section').hidden = false;
    $('status-filter-section').hidden = false;

    // Step 8: Re-render table with status column
    renderTableWithStatus();
  } catch (error) {
    if (error instanceof CancelledError) {
      // Cancelled: discard results, restore UI
      console.log('清洗操作已取消');
    } else {
      console.error('清洗过程出错:', error);
    }
  } finally {
    // Reset controller state: cancelled → idle or running → cancelled → idle
    if (cleanseController.state === 'running' || cleanseController.state === 'paused') {
      cleanseController.cancel();
    }
    cleanseController.reset();
    progressSection.hidden = true;
    resetCleanseUI(0);
  }
}

// --- Clear handling ---

/**
 * Handle clear data action.
 * Shows confirmation dialog, clears storage and resets UI if confirmed.
 */
async function handleClear(): Promise<void> {
  const confirmed = confirm('确定要清除所有已导入的外链数据吗？');
  if (!confirmed) return;

  await clearRecords();
  currentRecords = [];
  removeStatusDropdown();
  renderTableWithStatus();
  $('summary-section').hidden = true;
  $('cleanse-btn').hidden = true;
  $('cleanse-summary-section').hidden = true;
  $('status-filter-section').hidden = true;
  currentCommentStatuses = {};
  currentFilterStatus = 'all';
}

// --- API Key settings ---

/**
 * 切换 API Key 设置区域的显示/隐藏
 */
function toggleApiKeySection(): void {
  const section = $('api-key-section');
  section.hidden = !section.hidden;
}

/**
 * 保存 API Key 到 chrome.storage.local
 */
async function handleSaveApiKey(): Promise<void> {
  const input = $('api-key-input') as HTMLInputElement;
  const msgEl = $('api-key-message');
  const value = input.value.trim();

  if (!value) {
    msgEl.textContent = 'API Key 不能为空';
    msgEl.style.color = '#dc2626';
    msgEl.hidden = false;
    return;
  }

  await chrome.storage.local.set({ dashscopeApiKey: value });
  msgEl.textContent = '保存成功';
  msgEl.style.color = '#065f46';
  msgEl.hidden = false;
  setTimeout(() => { msgEl.hidden = true; }, 2000);
}

/**
 * 初始化时加载已保存的 API Key
 */
async function loadSavedApiKey(): Promise<void> {
  const result = await chrome.storage.local.get(['dashscopeApiKey']) as { dashscopeApiKey?: string };
  if (result.dashscopeApiKey) {
    ($('api-key-input') as HTMLInputElement).value = result.dashscopeApiKey;
  }
}

/**
 * 初始化模型选择器：填充选项并加载已保存的选择
 */
async function initModelSelectors(): Promise<void> {
  const modelSelect = $('model-select') as HTMLSelectElement;
  const captchaSelect = $('captcha-model-select') as HTMLSelectElement;

  // 填充文本模型选项
  for (const m of AVAILABLE_MODELS) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    modelSelect.appendChild(opt);
  }

  // 填充验证码模型选项
  for (const m of AVAILABLE_VL_MODELS) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    captchaSelect.appendChild(opt);
  }

  // 加载已保存的选择
  const saved = await chrome.storage.local.get(['selectedModel', 'selectedCaptchaModel']) as {
    selectedModel?: string;
    selectedCaptchaModel?: string;
  };
  modelSelect.value = saved.selectedModel || DEFAULT_MODEL;
  captchaSelect.value = saved.selectedCaptchaModel || DEFAULT_CAPTCHA_MODEL;

  // 监听变化自动保存
  modelSelect.addEventListener('change', () => {
    chrome.storage.local.set({ selectedModel: modelSelect.value });
  });
  captchaSelect.addEventListener('change', () => {
    chrome.storage.local.set({ selectedCaptchaModel: captchaSelect.value });
  });

  // 思考模式开关
  const thinkingToggle = $('thinking-toggle') as HTMLInputElement;
  const savedThinking = await chrome.storage.local.get(['thinkingEnabled']) as { thinkingEnabled?: boolean };
  thinkingToggle.checked = savedThinking.thinkingEnabled || false;
  thinkingToggle.addEventListener('change', () => {
    chrome.storage.local.set({ thinkingEnabled: thinkingToggle.checked });
  });
}


// --- Column sort click handler ---

/**
 * Handle column header click for sorting.
 * Toggles sort order if clicking the same column, defaults to desc for new column.
 */
function handleColumnSort(column: string): void {
  if (column === currentSortColumn) {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = column;
    currentSortOrder = 'desc';
  }
  renderTableWithStatus();
}

// --- Initialization ---

/**
 * Initialize the Side Panel page.
 * - Load existing records from storage and render table
 * - Bind event listeners for import, clear, and column sort
 */
async function init(): Promise<void> {
  // Hide cleanse button initially
  $('cleanse-btn').hidden = true;

  // Load existing data
  currentRecords = await loadRecords();
  currentCommentStatuses = await loadCommentStatuses();
  renderTableWithStatus();

  // Show cleanse button if there are already loaded records
  $('cleanse-btn').hidden = currentRecords.length === 0;

  // Bind status filter click handlers
  renderStatusFilter();

  // If there are existing comment statuses, show filter section and cleanse summary
  if (Object.keys(currentCommentStatuses).length > 0) {
    $('status-filter-section').hidden = false;
    $('cleanse-summary-section').hidden = false;

    updateCleanseSummary();
  }

  // Bind import button → trigger hidden file input
  const importBtn = $('import-btn');
  const fileInput = $('file-input') as HTMLInputElement;

  importBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      handleImport(file);
    }
  });

  // Bind clear button
  $('clear-btn').addEventListener('click', () => {
    handleClear();
  });

  // Bind cleanse button (pause/resume toggle)
  $('cleanse-btn').addEventListener('click', () => {
    if (cleanseController.state === 'idle') {
      handleCleanse();
    } else if (cleanseController.state === 'running') {
      cleanseController.pause();
      updateCleanseButtonState();
    } else if (cleanseController.state === 'paused') {
      cleanseController.resume();
      updateCleanseButtonState();
    }
  });

  // Bind cleanse cancel button
  $('cleanse-cancel-btn').addEventListener('click', () => {
    if (cleanseController.state === 'running' || cleanseController.state === 'paused') {
      const confirmed = confirm('确定要取消清洗操作吗？已完成的进度将丢失。');
      if (confirmed) {
        cleanseController.cancel();
        updateCleanseButtonState();
      }
    }
  });

  // Bind column sort click handlers
  const headers = document.querySelectorAll('#data-table thead th[data-column]');
  for (const th of headers) {
    th.addEventListener('click', () => {
      const column = (th as HTMLElement).dataset.column;
      if (column) {
        handleColumnSort(column);
      }
    });
  }

  // Initialize template manager
  await initTemplateManager();

  // Bind settings button
  $('settings-btn').addEventListener('click', toggleApiKeySection);

  // Bind API Key save button
  $('api-key-save-btn').addEventListener('click', () => { handleSaveApiKey(); });

  // Load saved API Key
  await loadSavedApiKey();

  // Initialize model selectors
  await initModelSelectors();

  // Initialize auto-comment module (template/API key helpers only)
  initAutoComment();

  // Bind auto-comment button with cancel support
  const autoCommentBtn = $('auto-comment-btn') as HTMLButtonElement;
  autoCommentBtn.addEventListener('click', async () => {
    const currentState = autoCommentController.state;
    if (currentState === 'idle') {
      // Start auto-comment
      autoCommentController.start();
      autoCommentBtn.textContent = '取消评论';
      try {
        await runAutoComment(autoCommentController);
      } finally {
        const finalState = autoCommentController.state;
        if (finalState === 'running' || finalState === 'paused') {
          autoCommentController.cancel();
        }
        autoCommentController.reset();
        setTimeout(() => {
          autoCommentBtn.textContent = '自动评论';
          autoCommentBtn.disabled = false;
        }, 3000);
      }
    } else if (currentState === 'running') {
      // Cancel auto-comment
      autoCommentController.cancel();
      autoCommentBtn.textContent = '自动评论';
      autoCommentBtn.disabled = false;
    }
  });

  // Bind Escape key for pause/cancel
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;

    if (cleanseController.state === 'running') {
      cleanseController.pause();
      updateCleanseButtonState();
    } else if (autoCommentController.state === 'running') {
      autoCommentController.cancel();
      autoCommentBtn.textContent = '自动评论';
      autoCommentBtn.disabled = false;
    }
  });
}

// Start on DOM ready
document.addEventListener('DOMContentLoaded', init);
