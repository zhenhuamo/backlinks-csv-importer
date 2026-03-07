import { LinkTemplate } from './types';
import { loadTemplates, saveTemplates, generateId } from './link-template-storage';

// --- State ---
let templates: LinkTemplate[] = [];
let selectedId: string | null = null;
let editingId: string | null = null;

// --- DOM helpers ---
function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

/**
 * 初始化模板管理模块
 */
export async function initTemplateManager(): Promise<void> {
  // Toggle button
  $('template-toggle-btn').addEventListener('click', async () => {
    const section = $('template-section');
    const btn = $('template-toggle-btn');
    if (section.hidden) {
      section.hidden = false;
      btn.classList.add('active');
      templates = await loadTemplates();
      refreshSelect();
    } else {
      section.hidden = true;
      btn.classList.remove('active');
      hideForm();
    }
  });

  // Dropdown change
  $('template-select').addEventListener('change', () => {
    const select = $('template-select') as HTMLSelectElement;
    selectedId = select.value || null;
    renderDetail();
    hideForm();
  });

  // Add button
  $('template-add-btn').addEventListener('click', () => showForm());

  // Edit current
  $('template-edit-current-btn').addEventListener('click', () => {
    const tpl = templates.find(t => t.id === selectedId);
    if (tpl) showForm(tpl);
  });

  // Delete current
  $('template-delete-current-btn').addEventListener('click', () => handleDelete());

  // Save button
  $('template-save-btn').addEventListener('click', () => handleSave());

  // Cancel button
  $('template-cancel-btn').addEventListener('click', () => hideForm());
}

/**
 * 刷新下拉选择器
 */
function refreshSelect(): void {
  const select = $('template-select') as HTMLSelectElement;
  const currentValue = selectedId;
  select.innerHTML = '<option value="">-- 选择模板 --</option>';

  for (const tpl of templates) {
    const opt = document.createElement('option');
    opt.value = tpl.id;
    opt.textContent = tpl.name;
    select.appendChild(opt);
  }

  // Restore selection or auto-select
  if (currentValue && templates.some(t => t.id === currentValue)) {
    select.value = currentValue;
    selectedId = currentValue;
  } else if (templates.length > 0) {
    select.value = templates[0].id;
    selectedId = templates[0].id;
  } else {
    selectedId = null;
  }

  renderDetail();
  $('template-empty').hidden = templates.length > 0;
}

/**
 * 渲染选中模板的详情卡片
 */
function renderDetail(): void {
  const detailEl = $('template-detail');
  const editBtn = $('template-edit-current-btn');
  const deleteBtn = $('template-delete-current-btn');
  detailEl.innerHTML = '';

  const tpl = templates.find(t => t.id === selectedId);
  if (!tpl) {
    detailEl.hidden = true;
    editBtn.hidden = true;
    deleteBtn.hidden = true;
    return;
  }

  detailEl.hidden = false;
  editBtn.hidden = false;
  deleteBtn.hidden = false;

  const fields: Array<{ label: string; value: string }> = [
    { label: '名称:', value: tpl.name },
    { label: '网址:', value: tpl.url },
    { label: '关键词:', value: tpl.keyword },
  ];

  for (const field of fields) {
    const row = document.createElement('div');
    row.className = 'template-field';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'template-field-label';
    labelSpan.textContent = field.label;
    row.appendChild(labelSpan);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'template-field-value';
    valueSpan.textContent = field.value;
    valueSpan.title = field.value;
    row.appendChild(valueSpan);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'template-copy-btn';
    copyBtn.textContent = '📋';
    copyBtn.addEventListener('click', () => copyToClipboard(field.value, copyBtn));
    row.appendChild(copyBtn);

    detailEl.appendChild(row);
  }
}

/**
 * 显示添加/编辑表单
 */
function showForm(template?: LinkTemplate): void {
  const form = $('template-form');
  const nameInput = $('template-name') as HTMLInputElement;
  const urlInput = $('template-url') as HTMLInputElement;
  const keywordInput = $('template-keyword') as HTMLInputElement;

  if (template) {
    editingId = template.id;
    nameInput.value = template.name;
    urlInput.value = template.url;
    keywordInput.value = template.keyword;
  } else {
    editingId = null;
    nameInput.value = '';
    urlInput.value = '';
    keywordInput.value = '';
  }

  form.hidden = false;
  nameInput.focus();
}

/**
 * 隐藏表单并清空输入
 */
function hideForm(): void {
  ($('template-name') as HTMLInputElement).value = '';
  ($('template-url') as HTMLInputElement).value = '';
  ($('template-keyword') as HTMLInputElement).value = '';
  editingId = null;
  $('template-form').hidden = true;
}

/**
 * 处理保存操作（新增或更新）
 */
async function handleSave(): Promise<void> {
  const name = ($('template-name') as HTMLInputElement).value.trim();
  const url = ($('template-url') as HTMLInputElement).value.trim();
  const keyword = ($('template-keyword') as HTMLInputElement).value.trim();

  if (!name) {
    alert('名称不能为空');
    return;
  }

  if (editingId) {
    const idx = templates.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      templates[idx] = { ...templates[idx], name, url, keyword };
      selectedId = editingId;
    }
  } else {
    const newId = generateId();
    templates.push({ id: newId, name, url, keyword });
    selectedId = newId;
  }

  await saveTemplates(templates);
  hideForm();
  refreshSelect();
}

/**
 * 处理删除操作
 */
async function handleDelete(): Promise<void> {
  if (!selectedId) return;
  if (!confirm('确定要删除该模板吗？')) return;
  templates = templates.filter(t => t.id !== selectedId);
  selectedId = null;
  await saveTemplates(templates);
  refreshSelect();
}

/**
 * 复制字段值到剪贴板
 */
async function copyToClipboard(text: string, buttonEl: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    buttonEl.textContent = '✅';
    setTimeout(() => { buttonEl.textContent = '📋'; }, 1000);
  } catch (error) {
    console.error('复制失败', error);
  }
}
