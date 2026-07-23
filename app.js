/*
 * To Do List v2 — 마감일 없는 버전
 * FR1: 일정 추가 / FR2: 일정 삭제
 *
 * 구조:
 *   1. 상수
 *   2. 상태(state) 정의
 *   3. DOM 참조
 *   4. 저장소(storage) 함수 — localStorage 입출력만 담당
 *   5. 상태 변경(mutation) 함수 — state 배열을 바꾸는 일만 담당, DOM을 직접 건드리지 않는다
 *   6. 입력 검증 함수
 *   7. 렌더링(render) 함수 — state를 읽어 DOM에 반영하는 일만 담당, state를 바꾸지 않는다
 *   8. 이벤트 위임 핸들러
 *   9. 초기화
 */

(() => {
  // ---------------------------------------------------------------------
  // 1. 상수 — 코드에 그대로 등장하는 의미 있는 숫자/문자열에 이름을 붙인다
  // ---------------------------------------------------------------------
  const STORAGE_KEY_ACTIVE = 'todo-v2-active';
  const STORAGE_KEY_HISTORY = 'todo-v2-history';

  const TASK_TITLE_MAX_LENGTH = 120;   // 일정 제목 최대 글자 수 (JS에서도 재검증)
  const ID_RANDOM_START_INDEX = 2;     // 임시 id 생성 시 랜덤 문자열 시작 위치
  const ID_RANDOM_END_INDEX = 6;       // 임시 id 생성 시 랜덤 문자열 끝 위치

  const DUPLICATE_TASK_CONFIRM_MESSAGE = '같은 내용의 일정이 이미 있어요. 그래도 추가하시겠습니까?';

  // 상위 요소 하나에서 이벤트를 위임받았을 때, data-action 값에 따라
  // 어떤 상태 변경 함수를 실행할지 매핑한다 (switch문 대신 객체 맵 사용)
  const TASK_LIST_ACTION_HANDLERS = {
    complete: handleCompleteTask,
    delete: handleDeleteActiveTask
  };
  const HISTORY_LIST_ACTION_HANDLERS = {
    restore: handleRestoreTask,
    delete: handleDeleteHistoryTask
  };

  // ---------------------------------------------------------------------
  // 2. 상태 — 서로 관련된 데이터는 개별 변수 대신 하나의 상태 객체로 묶는다
  // ---------------------------------------------------------------------
  const state = {
    active: [],   // 진행 중인 일정 배열. 배열 순서 = 추가된 순서(최신순)
    history: []   // 완료 처리된 일정 배열
  };

  // ---------------------------------------------------------------------
  // 3. DOM 참조
  // ---------------------------------------------------------------------
  const taskListEl = document.getElementById('taskList');
  const historyListEl = document.getElementById('historyList');
  const taskCardTemplate = document.getElementById('taskCardTemplate');
  const historyCardTemplate = document.getElementById('historyCardTemplate');
  const addForm = document.getElementById('addForm');
  const taskTitleInput = document.getElementById('taskTitleInput');
  const todoCountEl = document.getElementById('todoCount');
  const doneCountEl = document.getElementById('doneCount');
  const historyOpenBtn = document.getElementById('historyOpenBtn');
  const historyCloseBtn = document.getElementById('historyCloseBtn');
  const historyOverlayEl = document.getElementById('historyOverlay');
  const historyBackdropEl = document.getElementById('historyBackdrop');

  // ---------------------------------------------------------------------
  // 4. 저장소 함수 — localStorage 읽기/쓰기만 담당한다 (상태 변경 로직과 분리)
  // ---------------------------------------------------------------------

  // readListFromStorage(key): 지정한 key에 저장된 배열을 읽어 반환한다.
  // 저장된 값이 없거나 JSON 형식이 아니면 빈 배열을 반환한다.
  function readListFromStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  // writeListToStorage(key, list): 배열을 JSON 문자열로 변환해 지정한 key로 저장한다.
  function writeListToStorage(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
  }

  // persistActive(): 현재 state.active 배열을 localStorage에 저장한다.
  function persistActive() {
    writeListToStorage(STORAGE_KEY_ACTIVE, state.active);
  }

  // persistHistory(): 현재 state.history 배열을 localStorage에 저장한다.
  function persistHistory() {
    writeListToStorage(STORAGE_KEY_HISTORY, state.history);
  }

  // ---------------------------------------------------------------------
  // 5. 상태 변경 함수 — state의 active/history 배열만 바꾼다.
  //    DOM을 읽거나 쓰지 않고, 저장(storage)도 이 함수 안에서 하지 않는다.
  // ---------------------------------------------------------------------

  // generateTaskId(): 현재 시각과 임의 문자열을 조합해 충돌 가능성이 낮은 id를 만든다.
  function generateTaskId() {
    const randomPart = Math.random().toString(36).slice(ID_RANDOM_START_INDEX, ID_RANDOM_END_INDEX);
    return `${Date.now().toString(36)}${randomPart}`;
  }

  // createTaskRecord(title): 검증된 제목으로 새 일정 객체를 만들어 반환한다.
  // 이 함수는 배열에 넣는 일은 하지 않고, 객체를 만들기만 한다.
  function createTaskRecord(title) {
    return { id: generateTaskId(), title, completedAt: null };
  }

  // addTaskToActive(task): 새 일정을 진행 목록 맨 앞(최신 항목 자리)에 추가한다.
  function addTaskToActive(task) {
    state.active.unshift(task);
  }

  // removeTaskById(list, id): 배열에서 해당 id를 가진 항목을 제외한 새 배열을 반환한다.
  function removeTaskById(list, id) {
    return list.filter((task) => task.id !== id);
  }

  // moveActiveTaskToHistory(id): 진행 목록에서 해당 id를 찾아 완료 시각을 기록한 뒤
  // 완료 기록 목록 맨 앞으로 옮긴다. 대상이 없으면 아무 것도 하지 않는다.
  function moveActiveTaskToHistory(id) {
    const targetTask = state.active.find((task) => task.id === id);
    if (!targetTask) return;
    state.active = removeTaskById(state.active, id);
    targetTask.completedAt = new Date().toISOString();
    state.history.unshift(targetTask);
  }

  // moveHistoryTaskToActive(id): 완료 기록에서 해당 id를 찾아 완료 시각을 지운 뒤
  // 진행 목록 맨 앞으로 되돌린다. 대상이 없으면 아무 것도 하지 않는다.
  function moveHistoryTaskToActive(id) {
    const targetTask = state.history.find((task) => task.id === id);
    if (!targetTask) return;
    state.history = removeTaskById(state.history, id);
    targetTask.completedAt = null;
    state.active.unshift(targetTask);
  }

  // ---------------------------------------------------------------------
  // 6. 입력 검증 — HTML의 maxlength 속성만 믿지 않고 JS에서도 다시 검사한다
  // ---------------------------------------------------------------------

  // sanitizeTaskTitle(rawTitle): 앞뒤 공백을 제거하고 최대 길이를 강제한다.
  // 빈 문자열이면 null을 반환해 "추가할 수 없는 입력"임을 알린다.
  function sanitizeTaskTitle(rawTitle) {
    const trimmed = String(rawTitle || '').trim();
    if (trimmed.length === 0) return null;
    return trimmed.slice(0, TASK_TITLE_MAX_LENGTH);
  }

  // findDuplicateActiveTask(title): 진행 목록(state.active) 안에서
  // 제목이 동일한 일정이 이미 있는지 찾아 반환한다. 없으면 undefined.
  function findDuplicateActiveTask(title) {
    return state.active.find((task) => task.title === title);
  }

  // ---------------------------------------------------------------------
  // 7. 렌더링 함수 — state를 읽어 화면에 반영하기만 한다 (state를 바꾸지 않는다)
  // ---------------------------------------------------------------------

  // buildTaskCardElement(task): 진행 목록 카드 하나를 템플릿으로부터 만들어 반환한다.
  // 이벤트 리스너를 개별로 붙이지 않고, data-id/data-action만 표시해 상위에서 위임 처리한다.
  function buildTaskCardElement(task) {
    const cardEl = taskCardTemplate.content.firstElementChild.cloneNode(true);
    cardEl.dataset.id = task.id;
    cardEl.querySelector('.task-card__title').textContent = task.title;
    return cardEl;
  }

  // buildHistoryCardElement(task): 완료 기록 카드 하나를 템플릿으로부터 만들어 반환한다.
  function buildHistoryCardElement(task) {
    const cardEl = historyCardTemplate.content.firstElementChild.cloneNode(true);
    cardEl.dataset.id = task.id;
    cardEl.querySelector('.history-card__title').textContent = task.title;
    return cardEl;
  }

  // renderActiveList(): state.active 전체를 다시 그린다.
  // 반복 삽입은 DocumentFragment에 모았다가 한 번만 실제 DOM에 붙인다.
  function renderActiveList() {
    const fragment = document.createDocumentFragment();
    state.active.forEach((task) => fragment.appendChild(buildTaskCardElement(task)));
    taskListEl.replaceChildren(fragment);
  }

  // renderHistoryList(): state.history 전체를 최근 완료 순으로 다시 그린다.
  function renderHistoryList() {
    const fragment = document.createDocumentFragment();
    [...state.history]
      .reverse()
      .forEach((task) => fragment.appendChild(buildHistoryCardElement(task)));
    historyListEl.replaceChildren(fragment);
  }

  // renderCountBadge(): 진행 중(TODO) 개수와 완료(DONE) 개수를 각각의 뱃지에 표시한다.
  function renderCountBadge() {
    todoCountEl.textContent = state.active.length;
    doneCountEl.textContent = state.history.length;
  }

  // renderAll(): 화면에 보여지는 모든 부분을 한 번에 갱신한다.
  function renderAll() {
    renderActiveList();
    renderHistoryList();
    renderCountBadge();
  }

  // ---------------------------------------------------------------------
  // 8. 이벤트 위임 핸들러
  //    같은 유형의 버튼이 여러 개 반복되는 목록은 각 버튼이 아니라
  //    부모 요소(ul) 하나에만 리스너를 걸고 e.target으로 대상을 판단한다.
  // ---------------------------------------------------------------------

  // handleAddFormSubmit(event): FR1. 입력값을 검증한 뒤, 동일한 제목의 일정이
  // 이미 있는지 확인하고, 사용자가 승인한 경우에만 추가한다.
  function handleAddFormSubmit(event) {
    event.preventDefault();

    const validTitle = sanitizeTaskTitle(taskTitleInput.value);
    if (validTitle === null) {
      taskTitleInput.focus();
      return;
    }

    const duplicateTask = findDuplicateActiveTask(validTitle);
    if (duplicateTask) {
      const shouldCreateDuplicate = window.confirm(DUPLICATE_TASK_CONFIRM_MESSAGE);
      if (!shouldCreateDuplicate) return;
    }

    const newTask = createTaskRecord(validTitle);
    addTaskToActive(newTask);
    persistActive();
    renderAll();

    taskTitleInput.value = '';
    taskTitleInput.focus();
  }

  // handleCompleteTask(id): FR과 무관한 부가 기능. 완료 처리 후 저장하고 다시 그린다.
  function handleCompleteTask(id) {
    moveActiveTaskToHistory(id);
    persistActive();
    persistHistory();
    renderAll();
  }

  // handleDeleteActiveTask(id): FR2. 진행 목록에서 해당 일정을 제거하고 저장 후 다시 그린다.
  function handleDeleteActiveTask(id) {
    state.active = removeTaskById(state.active, id);
    persistActive();
    renderAll();
  }

  // handleRestoreTask(id): 완료 기록을 진행 목록으로 되돌리고 저장 후 다시 그린다.
  function handleRestoreTask(id) {
    moveHistoryTaskToActive(id);
    persistActive();
    persistHistory();
    renderAll();
  }

  // handleDeleteHistoryTask(id): 완료 기록에서 해당 일정을 완전히 제거하고 저장 후 다시 그린다.
  function handleDeleteHistoryTask(id) {
    state.history = removeTaskById(state.history, id);
    persistHistory();
    renderAll();
  }

  // handleTaskListClick(event): 진행 목록(ul) 하나에 걸린 위임 리스너.
  // 클릭된 지점에서 가장 가까운 [data-action] 요소를 찾아 어떤 동작인지 판단하고,
  // TASK_LIST_ACTION_HANDLERS 맵에서 해당 처리 함수를 찾아 실행한다.
  function handleTaskListClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const cardEl = actionEl.closest('.task-card');
    if (!cardEl) return;

    const handler = TASK_LIST_ACTION_HANDLERS[actionEl.dataset.action];
    if (handler) handler(cardEl.dataset.id);
  }

  // handleHistoryListClick(event): 완료 기록 목록(ul) 하나에 걸린 위임 리스너.
  function handleHistoryListClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const cardEl = actionEl.closest('.history-card');
    if (!cardEl) return;

    const handler = HISTORY_LIST_ACTION_HANDLERS[actionEl.dataset.action];
    if (handler) handler(cardEl.dataset.id);
  }

  // ---- 완료 기록 패널 열기/닫기 ----
  // openHistoryPanel(): 패널을 열고, 열리는 시점의 최신 완료 기록을 다시 그린다.
  function openHistoryPanel() {
    historyOverlayEl.classList.add('history-overlay--open');
    renderHistoryList();
  }
  // closeHistoryPanel(): 패널을 닫는다.
  function closeHistoryPanel() {
    historyOverlayEl.classList.remove('history-overlay--open');
  }

  // ---------------------------------------------------------------------
  // 이벤트 바인딩 — 인라인 onclick 대신 addEventListener로만 연결한다
  // ---------------------------------------------------------------------
  addForm.addEventListener('submit', handleAddFormSubmit);

  taskListEl.addEventListener('click', handleTaskListClick);

  historyListEl.addEventListener('click', handleHistoryListClick);

  historyOpenBtn.addEventListener('click', openHistoryPanel);
  historyCloseBtn.addEventListener('click', closeHistoryPanel);
  historyBackdropEl.addEventListener('click', closeHistoryPanel);

  // ---------------------------------------------------------------------
  // 9. 초기화 — 저장된 데이터를 state에 불러온 뒤 한 번 렌더링한다
  // ---------------------------------------------------------------------
  function initializeApp() {
    state.active = readListFromStorage(STORAGE_KEY_ACTIVE);
    state.history = readListFromStorage(STORAGE_KEY_HISTORY);
    renderAll();
  }

  initializeApp();
})();