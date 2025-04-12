document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const expenseForm = document.getElementById('expense-form');
    const expenseList = document.getElementById('expense-list');
    const filteredTotalDisplay = document.getElementById('filtered-total-expenses');
    const overallTotalDisplay = document.getElementById('overall-total-expenses');
    const formErrorDisplay = document.getElementById('form-error');
    const formSuccessDisplay = document.getElementById('form-success');
    const listErrorDisplay = document.getElementById('list-error');
    const filterCategorySelect = document.getElementById('filter-category');
    const filterSearchInput = document.getElementById('filter-search');
    const sortSelect = document.getElementById('sort-expenses');
    const categoryChartCanvas = document.getElementById('categoryChart');
    const loadingIndicator = document.getElementById('loading-indicator');
    const noExpensesMessage = document.querySelector('#expense-list .no-expenses');
    // Auth Elements
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginErrorDisplay = document.getElementById('login-error');
    const registerErrorDisplay = document.getElementById('register-error');
    const registerSuccessDisplay = document.getElementById('register-success');
    const logoutButton = document.getElementById('logout-btn');
    const welcomeMessageSpan = document.getElementById('welcome-message');
    const userInfoDiv = document.getElementById('user-info');
    // Edit Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editExpenseForm = document.getElementById('edit-expense-form');
    const editErrorDisplay = document.getElementById('edit-form-error');
    const editExpenseIdInput = document.getElementById('edit-expense-id');
    const editDescriptionInput = document.getElementById('edit-description');
    const editAmountInput = document.getElementById('edit-amount');
    const editCategoryInput = document.getElementById('edit-category');
    const editDateInput = document.getElementById('edit-date');
    // Action Bar Elements
    const dateFilterButtons = document.querySelectorAll('.btn-date-filter');
    const dateFilterStartInput = document.getElementById('date-filter-start');
    const dateFilterEndInput = document.getElementById('date-filter-end');
    const exportCsvButton = document.getElementById('export-csv-btn');
    const shareSelectedButton = document.getElementById('share-selected-btn');


    // --- App State ---
    const AUTH_API_URL = '/api/auth';
    const EXPENSE_API_URL = '/api/expenses';
    const CURRENCY_SYMBOL = '₹';
    let allExpenses = [];
    let categoryChart = null;
    // let currentToken = null; // Removed, value was never read
    // let currentUsername = null; // Removed, value was never read
    let selectedExpenseIds = new Set();
    let currentFilters = { category: 'All', searchTerm: '', dateRange: { start: null, end: null }, sortOrder: 'date_desc' };


    // --- Utility Functions ---
    const debounce = (func, delay) => { let timeoutId; return (...args) => { clearTimeout(timeoutId); timeoutId = setTimeout(() => { func.apply(this, args); }, delay); }; };
    const escapeHtmlCache = new Map(); // Cache for escapeHtml
    function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { return unsafe === null || unsafe === undefined ? '' : String(unsafe); } if (escapeHtmlCache.has(unsafe)) { return escapeHtmlCache.get(unsafe); } const escaped = unsafe .replace(/&/g, "&amp;") .replace(/</g, "&lt;") .replace(/>/g, "&gt;") .replace(/"/g, "&quot;") .replace(/'/g, "&#039;"); escapeHtmlCache.set(unsafe, escaped); return escaped; }
    function formatDate(dateString) { if (!dateString) return 'Invalid Date'; const options = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }; try { if (isNaN(Date.parse(dateString))) { console.warn("Invalid date string:", dateString); return dateString; } const date = new Date(dateString + 'T00:00:00Z'); return date.toLocaleDateString('en-GB', options); } catch(e) { console.error("Error formatting date:", dateString, e); return dateString; } }
    function showFeedback(element, message, isSuccess = true, duration = 4000) { if (!element) return; element.textContent = message; element.className = isSuccess ? 'success-message' : 'error-message'; element.style.display = 'block'; if (element.timeoutId) { clearTimeout(element.timeoutId); } element.timeoutId = setTimeout(() => { element.style.display = 'none'; element.textContent = ''; }, duration); }
    function showLoading(isLoading) { if (loadingIndicator) loadingIndicator.style.display = isLoading ? 'block' : 'none'; }


    // --- API Call Function ---
    async function apiRequest(url, options = {}) {
        showLoading(true);
        listErrorDisplay.textContent = ''; if(loginErrorDisplay) loginErrorDisplay.textContent = ''; if(registerErrorDisplay) registerErrorDisplay.textContent = ''; if(formErrorDisplay) formErrorDisplay.textContent = ''; if(editErrorDisplay) editErrorDisplay.textContent = '';
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        const token = getToken(); if (token) { headers['Authorization'] = `Bearer ${token}`; }
        try {
            const response = await fetch(url, { ...options, headers });
            if (response.status === 401 || response.status === 403) { if (url.startsWith(EXPENSE_API_URL)) { console.log('Auth token invalid/expired. Logging out.'); handleLogout(); return null; } }
            if (!response.ok) { let errorMsg = `Request failed! Status: ${response.status}`; try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { /* Ignore */ } throw new Error(errorMsg); }
            if (response.status === 204) { return null; } return await response.json();
        } catch (error) { console.error(`API Request Error (${options.method || 'GET'} ${url}):`, error); throw error; }
        finally { showLoading(false); }
    }


    // --- Authentication Functions ---
    function getToken() { return localStorage.getItem('expenseTrackerToken'); }
    function setToken(token) { if (token) { localStorage.setItem('expenseTrackerToken', token); } else { localStorage.removeItem('expenseTrackerToken'); } /* currentToken = token; */ } // Removed assignment to unused variable
    function setLoggedInUser(username) { if (username) { localStorage.setItem('expenseTrackerUsername', username); /* currentUsername = username; */ } else { localStorage.removeItem('expenseTrackerUsername'); /* currentUsername = null; */ } updateWelcomeMessage(); } // Removed assignment to unused variable
    function getLoggedInUser() { return localStorage.getItem('expenseTrackerUsername'); }
    function updateWelcomeMessage() { if (welcomeMessageSpan && userInfoDiv) { const username = getLoggedInUser(); if (username) { welcomeMessageSpan.textContent = `Welcome, ${escapeHtml(username)}!`; userInfoDiv.style.display = 'flex'; } else { welcomeMessageSpan.textContent = ''; userInfoDiv.style.display = 'none'; } } }
    async function handleRegisterSubmit(event) { event.preventDefault(); registerErrorDisplay.textContent = ''; registerSuccessDisplay.style.display = 'none'; const username = document.getElementById('register-username').value.trim(); const password = document.getElementById('register-password').value; const confirmPassword = document.getElementById('register-confirm-password').value; if (!username || !password || !confirmPassword) { showFeedback(registerErrorDisplay, 'Please fill in all fields.', false); return; } if (password.length < 6) { showFeedback(registerErrorDisplay, 'Password must be >= 6 characters.', false); return; } if (password !== confirmPassword) { showFeedback(registerErrorDisplay, 'Passwords do not match.', false); return; } try { const response = await apiRequest(`${AUTH_API_URL}/register`, { method: 'POST', body: JSON.stringify({ username, password }), }); if(response) { showFeedback(registerSuccessDisplay, 'Registration successful! Please login.', true); registerForm.reset(); showLoginView(); } } catch (error) { showFeedback(registerErrorDisplay, error.message || 'Registration failed.', false); } }
    async function handleLoginSubmit(event) { event.preventDefault(); loginErrorDisplay.textContent = ''; const username = document.getElementById('login-username').value.trim(); const password = document.getElementById('login-password').value; if (!username || !password) { showFeedback(loginErrorDisplay, 'Please enter username and password.', false); return; } try { const response = await apiRequest(`${AUTH_API_URL}/login`, { method: 'POST', body: JSON.stringify({ username, password }), }); if (response && response.token) { setToken(response.token); setLoggedInUser(response.user?.username || username); updateUIForLoginState(); loadPreferences(); fetchExpenses(); } else if (response && !response.token){ showFeedback(loginErrorDisplay, 'Login failed: Invalid response.', false); } } catch (error) { showFeedback(loginErrorDisplay, error.message || 'Login failed.', false); } }
    function handleLogout() { setToken(null); setLoggedInUser(null); allExpenses = []; updateUIForLoginState(); renderExpenseList([]); updateChart([]); if(filteredTotalDisplay) filteredTotalDisplay.textContent = `${CURRENCY_SYMBOL}0.00`; if(overallTotalDisplay) overallTotalDisplay.textContent = `${CURRENCY_SYMBOL}0.00`; if(filterCategorySelect) filterCategorySelect.value = 'All'; if(filterSearchInput) filterSearchInput.value = ''; if(sortSelect) sortSelect.value = 'date_desc'; clearDateFilters(); selectedExpenseIds.clear(); updateActionButtonsState(); console.log('User logged out.'); }


    // --- UI Update Functions ---
    function showLoginView() { if(loginSection) loginSection.style.display = 'block'; if(registerSection) registerSection.style.display = 'none'; }
    function showRegisterView() { if(loginSection) loginSection.style.display = 'none'; if(registerSection) registerSection.style.display = 'block'; }
    function updateUIForLoginState() { const token = getToken(); if (!authContainer || !appContainer || !userInfoDiv) { console.error("UI container element(s) not found!"); return; } if (token) { authContainer.classList.add('hidden'); appContainer.classList.remove('hidden'); updateWelcomeMessage(); } else { authContainer.classList.remove('hidden'); appContainer.classList.add('hidden'); updateWelcomeMessage(); showLoginView(); } }
    function updateActionButtonsState() { if (shareSelectedButton) { shareSelectedButton.disabled = selectedExpenseIds.size === 0; } }


    // --- Rendering & Filtering/Sorting ---
    function sortExpenses(expenses, sortOrder) { return [...expenses].sort((a, b) => { const valA = parseFloat(a.amount); const valB = parseFloat(b.amount); const descA = a.description?.toLowerCase() || ''; const descB = b.description?.toLowerCase() || ''; const catA = a.category?.toLowerCase() || ''; const catB = b.category?.toLowerCase() || ''; switch (sortOrder) { case 'date_asc': return new Date(a.date) - new Date(b.date); case 'amount_desc': return valB - valA; case 'amount_asc': return valA - valB; case 'description_asc': return descA.localeCompare(descB); case 'category_asc': return catA.localeCompare(catB); case 'date_desc': default: return new Date(b.date) - new Date(a.date); } }); }

    function renderFilteredAndSortedExpenses() {
        const categoryFilter = currentFilters.category; const searchTerm = currentFilters.searchTerm; const { start: startDate, end: endDate } = currentFilters.dateRange;
        console.log("Rendering with filters/sort:", currentFilters);
        let filtered = allExpenses.filter(expense => { const categoryMatch = categoryFilter === 'All' || expense.category === categoryFilter; const searchMatch = searchTerm === '' || (expense.description && expense.description.toLowerCase().includes(searchTerm)); let dateMatch = true; if (startDate || endDate) { try { const expenseDate = new Date(expense.date + 'T00:00:00Z'); if (startDate && expenseDate < startDate) dateMatch = false; if (endDate && expenseDate >= endDate) dateMatch = false; } catch(e) { dateMatch = false; } } return categoryMatch && searchMatch && dateMatch; });
        const sorted = sortExpenses(filtered, currentFilters.sortOrder);
        renderExpenseList(sorted); updateChart(sorted);
    }

    function renderExpenseList(expensesToRender) {
        if (!expenseList) return; expenseList.innerHTML = ''; let displayedTotal = 0; selectedExpenseIds.clear(); updateActionButtonsState();
        if (expensesToRender.length === 0) { if (noExpensesMessage) noExpensesMessage.style.display = 'block'; }
        else { if (noExpensesMessage) noExpensesMessage.style.display = 'none';
            expensesToRender.forEach(expense => {
                const amountAsNumber = parseFloat(expense.amount); if (isNaN(amountAsNumber)) { console.error("Invalid amount:", expense); return; } displayedTotal += amountAsNumber; const listItem = document.createElement('li'); listItem.setAttribute('data-id', expense.id); listItem.classList.add('fade-in');
                listItem.innerHTML = ` <div class="expense-select"> <input type="checkbox" class="expense-checkbox" value="${expense.id}" title="Select this expense"> </div> <div class="details"> <span class="description">${escapeHtml(expense.description)}</span> <span class="category">${escapeHtml(expense.category)}</span> <span class="date">${formatDate(expense.date)}</span> </div> <div class="amount">${CURRENCY_SYMBOL}${amountAsNumber.toFixed(2)}</div> <div class="actions"> <button class="btn-edit" title="Edit Expense"><i class="fas fa-edit"></i></button> <button class="btn-delete" title="Delete Expense"><i class="fas fa-trash-alt"></i></button> </div>`;
                expenseList.appendChild(listItem);
            });
        }
        if(filteredTotalDisplay) filteredTotalDisplay.textContent = `${CURRENCY_SYMBOL}${displayedTotal.toFixed(2)}`;
    }

    function updateOverallTotal() { if (!overallTotalDisplay) return; const total = allExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0); overallTotalDisplay.textContent = `${CURRENCY_SYMBOL}${total.toFixed(2)}`; }
    function populateCategoryFilter() { if (!filterCategorySelect) return; const categories = new Set(allExpenses.map(exp => exp.category)); const currentFilterValue = filterCategorySelect.value; while (filterCategorySelect.options.length > 1) { filterCategorySelect.remove(1); } Array.from(categories).sort().forEach(category => { const option = document.createElement('option'); option.value = category; option.textContent = escapeHtml(category); filterCategorySelect.appendChild(option); }); filterCategorySelect.value = currentFilterValue; if (filterCategorySelect.selectedIndex === -1) { filterCategorySelect.value = 'All'; } }
    function initializeChart() { if (!categoryChartCanvas) return; const ctx = categoryChartCanvas.getContext('2d'); if (categoryChart) { categoryChart.destroy(); } categoryChart = new Chart(ctx, { type: 'doughnut', data: { labels: [], datasets: [{ label: 'Expenses by Category', data: [], backgroundColor: ['#4a90e2', '#50e3c2', '#f5a623', '#bd10e0', '#7ed321', '#f8e71c', '#9013fe', '#417505', '#d0021b', '#b8e986'], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', }, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } if (context.parsed !== null) { label += CURRENCY_SYMBOL + context.parsed.toFixed(2); } return label; } } } } } }); }
    function updateChart(expensesForChart) { if (!categoryChart) return; const categoryTotals = expensesForChart.reduce((acc, expense) => { const amount = parseFloat(expense.amount) || 0; acc[expense.category] = (acc[expense.category] || 0) + amount; return acc; }, {}); const labels = Object.keys(categoryTotals); const data = Object.values(categoryTotals); categoryChart.data.labels = labels.map(label => escapeHtml(label)); categoryChart.data.datasets[0].data = data; categoryChart.update(); }


    // --- Expense Handlers ---
    async function fetchExpenses() {
        try { // Ensure try block
            const data = await apiRequest(EXPENSE_API_URL);
            allExpenses = data || [];
            updateOverallTotal();
            populateCategoryFilter();
            // *** CORRECTED FUNCTION CALL ***
            applyPreferencesToUI(); // Apply loaded prefs to UI elements
            renderFilteredAndSortedExpenses(); // Render based on current filters/sort
        } catch (error) { // Ensure catch block
            console.error("fetchExpenses failed:", error); // Log the actual error
            allExpenses = [];
            updateOverallTotal();
            renderFilteredAndSortedExpenses(); // Render empty state
        }
    }
    async function handleAddExpense(event) { event.preventDefault(); if(!formErrorDisplay || !formSuccessDisplay) return; formErrorDisplay.textContent = ''; formSuccessDisplay.style.display = 'none'; const descriptionInput = document.getElementById('description'); const amountInput = document.getElementById('amount'); const categoryInput = document.getElementById('category'); const dateInput = document.getElementById('date'); const description = descriptionInput?.value.trim(); const amount = amountInput?.value; const category = categoryInput?.value; const date = dateInput?.value; if (!description || !amount || !category || !date) { showFeedback(formErrorDisplay, 'Please fill in all fields.', false); return; } const parsedAmount = parseFloat(amount); if (isNaN(parsedAmount) || parsedAmount <= 0) { showFeedback(formErrorDisplay, 'Amount must be > 0.', false); return; } if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showFeedback(formErrorDisplay, 'Invalid date format.', false); return; } const newExpense = { description, amount: parsedAmount, category, date }; try { const addedExpense = await apiRequest(EXPENSE_API_URL, { method: 'POST', body: JSON.stringify(newExpense), }); if (addedExpense) { allExpenses.push(addedExpense); updateOverallTotal(); populateCategoryFilter(); renderFilteredAndSortedExpenses(); showFeedback(formSuccessDisplay, 'Expense added!', true); if(expenseForm) expenseForm.reset(); if(dateInput) dateInput.valueAsDate = new Date(); } } catch (error) { showFeedback(formErrorDisplay, error.message || 'Failed to add.', false); } }
    function handleListClick(event) { const deleteButton = event.target.closest('.btn-delete'); const editButton = event.target.closest('.btn-edit'); if (deleteButton) { const listItem = deleteButton.closest('li'); const expenseId = listItem?.getAttribute('data-id'); if (expenseId) handleDeleteExpense(expenseId, listItem); } else if (editButton) { const listItem = editButton.closest('li'); const expenseId = listItem?.getAttribute('data-id'); if (expenseId) handleEditClick(expenseId); } }
    async function handleDeleteExpense(expenseId, listItem) { if (!confirm('Are you sure?')) return; try { listItem.classList.add('fade-out'); await new Promise(resolve => setTimeout(resolve, 300)); await apiRequest(`${EXPENSE_API_URL}/${expenseId}`, { method: 'DELETE' }); allExpenses = allExpenses.filter(expense => expense.id !== parseInt(expenseId)); updateOverallTotal(); populateCategoryFilter(); renderFilteredAndSortedExpenses(); showFeedback(listErrorDisplay, 'Expense deleted.', true, 2000); } catch (error) { listItem.classList.remove('fade-out'); showFeedback(listErrorDisplay, error.message || 'Failed to delete.', false); } }
    function handleEditClick(expenseId) { const expenseToEdit = allExpenses.find(exp => exp.id === parseInt(expenseId)); if (!expenseToEdit) { console.error("Expense not found:", expenseId); showFeedback(listErrorDisplay, 'Could not find data to edit.', false); return; } if(editExpenseIdInput) editExpenseIdInput.value = expenseToEdit.id; if(editDescriptionInput) editDescriptionInput.value = expenseToEdit.description; if(editAmountInput) editAmountInput.value = parseFloat(expenseToEdit.amount).toFixed(2); if(editCategoryInput) editCategoryInput.value = expenseToEdit.category; if(editDateInput) editDateInput.value = expenseToEdit.date; if(editErrorDisplay) editErrorDisplay.textContent = ''; if(editModal) editModal.style.display = 'block'; }
    window.closeEditModal = function() { if(editModal) editModal.style.display = 'none'; }
    async function handleUpdateExpense(event) { event.preventDefault(); if(!editErrorDisplay) return; editErrorDisplay.textContent = ''; const id = editExpenseIdInput?.value; const description = editDescriptionInput?.value.trim(); const amount = editAmountInput?.value; const category = editCategoryInput?.value; const date = editDateInput?.value; if (!id || !description || !amount || !category || !date) { showFeedback(editErrorDisplay, 'Please fill in all fields.', false); return; } const parsedAmount = parseFloat(amount); if (isNaN(parsedAmount) || parsedAmount <= 0) { showFeedback(editErrorDisplay, 'Amount must be > 0.', false); return; } if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showFeedback(editErrorDisplay, 'Invalid date format.', false); return; } const updatedExpenseData = { description, amount: parsedAmount, category, date }; try { const updatedExpenseFromServer = await apiRequest(`${EXPENSE_API_URL}/${id}`, { method: 'PUT', body: JSON.stringify(updatedExpenseData), }); if (updatedExpenseFromServer) { const index = allExpenses.findIndex(exp => exp.id === parseInt(id)); if (index !== -1) { allExpenses[index] = updatedExpenseFromServer; } else { allExpenses.push(updatedExpenseFromServer); } updateOverallTotal(); populateCategoryFilter(); renderFilteredAndSortedExpenses(); closeEditModal(); showFeedback(listErrorDisplay, 'Expense updated!', true); } else { if (getToken()) { showFeedback(editErrorDisplay, 'Update failed.', false); fetchExpenses(); } closeEditModal(); } } catch (error) { showFeedback(editErrorDisplay, error.message || 'Failed to update.', false); } }


    // --- Filter/Sort/Action Handlers ---
    const handleSearchInput = debounce(() => { if(filterSearchInput) currentFilters.searchTerm = filterSearchInput.value.toLowerCase().trim(); savePreferences(); renderFilteredAndSortedExpenses(); }, 300);
    function handleCategoryFilterChange() { if(filterCategorySelect) currentFilters.category = filterCategorySelect.value; savePreferences(); renderFilteredAndSortedExpenses(); }
    function handleSortChange() { if(sortSelect) currentFilters.sortOrder = sortSelect.value; savePreferences(); renderFilteredAndSortedExpenses(); }
    function handleDateFilterClick(event) { if (!event.target.classList.contains('btn-date-filter')) return; dateFilterButtons.forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); const range = event.target.getAttribute('data-range'); const now = new Date(); now.setUTCHours(0, 0, 0, 0); let startDate = null; let endDate = null; let tempEndDate = new Date(now); tempEndDate.setUTCDate(tempEndDate.getUTCDate() + 1); tempEndDate.setUTCHours(0, 0, 0, 0); if (range === '7') { startDate = new Date(now); startDate.setUTCDate(now.getUTCDate() - 6); endDate = tempEndDate; } else if (range === '30') { startDate = new Date(now); startDate.setUTCDate(now.getUTCDate() - 29); endDate = tempEndDate; } else if (range === 'month') { startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); endDate = tempEndDate; } if (dateFilterStartInput) dateFilterStartInput.value = ''; if (dateFilterEndInput) dateFilterEndInput.value = ''; currentFilters.dateRange = { start: startDate, end: endDate }; savePreferences(); renderFilteredAndSortedExpenses(); }
    function handleCustomDateChange() { const startValue = dateFilterStartInput?.value; const endValue = dateFilterEndInput?.value; let startDate = null; let endDate = null; if (startValue || endValue) { dateFilterButtons.forEach(btn => btn.classList.remove('active')); } try { if (startValue) { startDate = new Date(startValue + 'T00:00:00Z'); if (isNaN(startDate)) startDate = null; } if (endValue) { endDate = new Date(endValue + 'T00:00:00Z'); if (isNaN(endDate)) { endDate = null; } else { endDate.setUTCDate(endDate.getUTCDate() + 1); } } if (startDate && endDate && endDate <= startDate) { console.warn("End date <= start date."); endDate = null; if(dateFilterEndInput) dateFilterEndInput.value = '';} currentFilters.dateRange = { start: startDate, end: endDate }; savePreferences(); renderFilteredAndSortedExpenses(); } catch (e) { console.error("Error custom date range:", e); currentFilters.dateRange = { start: null, end: null }; savePreferences(); renderFilteredAndSortedExpenses(); } }
    function clearDateFilters() { if(dateFilterButtons) dateFilterButtons.forEach(btn => btn.classList.remove('active')); const allTimeButton = document.querySelector('.btn-date-filter[data-range="all"]'); if (allTimeButton) allTimeButton.classList.add('active'); if (dateFilterStartInput) dateFilterStartInput.value = ''; if (dateFilterEndInput) dateFilterEndInput.value = ''; currentFilters.dateRange = { start: null, end: null }; }
    function handleCheckboxChange(event) { if (!event.target.classList.contains('expense-checkbox')) return; const checkbox = event.target; const expenseId = parseInt(checkbox.value, 10); if (checkbox.checked) { selectedExpenseIds.add(expenseId); } else { selectedExpenseIds.delete(expenseId); } updateActionButtonsState(); }
    function handleShareSelected() { if (selectedExpenseIds.size === 0) { alert('Please select expenses to share.'); return; } let shareText = "My Expenses:\n"; let shareTotal = 0; const selectedExpenses = allExpenses.filter(exp => selectedExpenseIds.has(exp.id)); selectedExpenses.sort((a, b) => new Date(a.date) - new Date(b.date)); selectedExpenses.forEach(expense => { const amount = parseFloat(expense.amount).toFixed(2); shareText += `- ${formatDate(expense.date)}: ${expense.description} (${expense.category}) - ${CURRENCY_SYMBOL}${amount}\n`; shareTotal += parseFloat(expense.amount); }); shareText += `\nTotal Selected: ${CURRENCY_SYMBOL}${shareTotal.toFixed(2)}`; const encodedText = encodeURIComponent(shareText); const whatsappUrl = `https://wa.me/?text=${encodedText}`; window.open(whatsappUrl, '_blank'); }
    function handleExportCsv() { const categoryFilter = currentFilters.category; const searchTerm = currentFilters.searchTerm; const { start: startDate, end: endDate } = currentFilters.dateRange; const expensesToExport = allExpenses.filter(expense => { const categoryMatch = categoryFilter === 'All' || expense.category === categoryFilter; const searchMatch = searchTerm === '' || (expense.description && expense.description.toLowerCase().includes(searchTerm)); let dateMatch = true; if (startDate || endDate) { try { const expenseDate = new Date(expense.date + 'T00:00:00Z'); if (startDate && expenseDate < startDate) dateMatch = false; if (endDate && expenseDate >= endDate) dateMatch = false; } catch(e) { dateMatch = false; } } return categoryMatch && searchMatch && dateMatch; }); if (expensesToExport.length === 0) { alert('No expenses in current view to export.'); return; } const headers = ['ID', 'Date', 'Description', 'Category', 'Amount']; const csvRows = [headers.join(',')]; expensesToExport.forEach(exp => { const amount = parseFloat(exp.amount).toFixed(2); const description = `"${escapeHtml(exp.description || '').replace(/"/g, '""')}"`; const category = `"${escapeHtml(exp.category || '').replace(/"/g, '""')}"`; const row = [exp.id, exp.date, description, category, amount]; csvRows.push(row.join(',')); }); const csvContent = csvRows.join('\n'); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute('href', url); const timestamp = new Date().toISOString().slice(0, 10); link.setAttribute('download', `expenses_${timestamp}.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); } else { alert('CSV export not supported.'); } }


    // --- Local Storage Preferences ---
    function savePreferences() { const prefs = { category: currentFilters.category, sortOrder: currentFilters.sortOrder }; localStorage.setItem('expenseTrackerPrefs', JSON.stringify(prefs)); }
    function loadPreferences() { const savedPrefs = localStorage.getItem('expenseTrackerPrefs'); if (savedPrefs) { try { const prefs = JSON.parse(savedPrefs); currentFilters.category = prefs.category || 'All'; currentFilters.sortOrder = prefs.sortOrder || 'date_desc'; } catch (e) { console.error("Error loading prefs:", e); currentFilters.category = 'All'; currentFilters.sortOrder = 'date_desc'; } } else { currentFilters.category = 'All'; currentFilters.sortOrder = 'date_desc'; } applyPreferencesToUI(); clearDateFilters(); }
    // *** CORRECTED FUNCTION NAME ***
    function applyPreferencesToUI() { if (filterCategorySelect) filterCategorySelect.value = currentFilters.category; if (sortSelect) sortSelect.value = currentFilters.sortOrder; if (filterSearchInput) filterSearchInput.value = currentFilters.searchTerm; }


    // --- Event Listeners Setup ---
    if(loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if(registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);
    if(logoutButton) logoutButton.addEventListener('click', handleLogout);
    if(showRegisterLink) showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showRegisterView(); });
    if(showLoginLink) showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showLoginView(); });
    if(expenseForm) expenseForm.addEventListener('submit', handleAddExpense);
    if(editExpenseForm) editExpenseForm.addEventListener('submit', handleUpdateExpense);
    if(expenseList) expenseList.addEventListener('click', handleListClick);
    if(expenseList) expenseList.addEventListener('change', handleCheckboxChange);
    if(filterCategorySelect) filterCategorySelect.addEventListener('change', handleCategoryFilterChange);
    if(sortSelect) sortSelect.addEventListener('change', handleSortChange);
    if(filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
    if(dateFilterButtons) dateFilterButtons.forEach(button => button.addEventListener('click', handleDateFilterClick));
    if(dateFilterStartInput) dateFilterStartInput.addEventListener('change', handleCustomDateChange);
    if(dateFilterEndInput) dateFilterEndInput.addEventListener('change', handleCustomDateChange);
    if(exportCsvButton) exportCsvButton.addEventListener('click', handleExportCsv);
    if(shareSelectedButton) shareSelectedButton.addEventListener('click', handleShareSelected);
    window.addEventListener('click', (event) => { if (editModal && event.target === editModal) { closeEditModal(); } });


    // --- Initial Load ---
    function initializeApp() {
        console.log("Initializing app...");
        const dateInputElement = document.getElementById('date');
        if(dateInputElement) { dateInputElement.valueAsDate = new Date(); }

        initializeChart();
        loadPreferences(); // Load saved filters/sort FIRST
        updateUIForLoginState(); // Update UI based on token presence

        const token = getToken();
        if (token) {
            console.log("Token found, fetching initial expenses.");
            fetchExpenses(); // Fetch data, THEN applies prefs and renders
        } else {
            console.log("No token found, showing auth screen.");
            updateChart([]); // Show empty chart
        }
    }

    initializeApp(); // Start the application

});