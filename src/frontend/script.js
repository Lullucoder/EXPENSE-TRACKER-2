document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const expenseForm = document.getElementById('expense-form');
    const expenseList = document.getElementById('expense-list');
    const totalExpensesDisplay = document.getElementById('total-expenses');
    const formErrorDisplay = document.getElementById('form-error');
    const formSuccessDisplay = document.getElementById('form-success');
    const listErrorDisplay = document.getElementById('list-error');
    const filterCategorySelect = document.getElementById('filter-category');
    const filterSearchInput = document.getElementById('filter-search');
    const categoryChartCanvas = document.getElementById('categoryChart');
    const loadingIndicator = document.getElementById('loading-indicator');
    const noExpensesMessage = document.querySelector('#expense-list .no-expenses');

    // Edit Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editExpenseForm = document.getElementById('edit-expense-form');
    const editErrorDisplay = document.getElementById('edit-form-error');
    const editExpenseIdInput = document.getElementById('edit-expense-id');
    const editDescriptionInput = document.getElementById('edit-description');
    const editAmountInput = document.getElementById('edit-amount');
    const editCategoryInput = document.getElementById('edit-category');
    const editDateInput = document.getElementById('edit-date');

    // --- App State ---
    const API_URL = '/api/expenses';
    const CURRENCY_SYMBOL = '₹';
    let allExpenses = []; // Cache for all expenses fetched from server
    let categoryChart = null; // To hold the Chart.js instance

    // --- Utility Functions ---
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    };

    // Basic HTML escaping helper
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') {
            return unsafe === null || unsafe === undefined ? '' : String(unsafe);
        }
        return unsafe
                 .replace(/&/g, "&")
                 .replace(/</g, "<")
                 .replace(/>/g, ">")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#39;");
    }

    // Helper function to format date (e.g., DD Mon YYYY)
    function formatDate(dateString) {
        // ... (keep the previous corrected formatDate function) ...
        if (!dateString) return 'Invalid Date'; // Handle null/undefined dateString
        const options = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }; // Specify UTC to avoid timezone shifts
        try {
            if (isNaN(Date.parse(dateString))) {
                 console.warn("Invalid date string received:", dateString);
                 return dateString; // Return original invalid string
            }
            const date = new Date(dateString + 'T00:00:00Z'); // Append Z for UTC
            return date.toLocaleDateString('en-GB', options); // Adjust locale 'en-GB' for DD Mon YYYY as needed
        } catch(e) {
            console.error("Error formatting date:", dateString, e);
            return dateString; // Return original on unexpected error
        }
    }

     // Show temporary success/error messages
    function showFeedback(element, message, isSuccess = true, duration = 3000) {
        element.textContent = message;
        element.className = isSuccess ? 'success-message' : 'error-message';
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, duration);
    }

    // Show/Hide Loading Indicator
    function showLoading(isLoading) {
         loadingIndicator.style.display = isLoading ? 'block' : 'none';
         // Optionally hide the list while loading initial data
         // expenseList.style.display = isLoading ? 'none' : 'block';
    }

    // --- API Call Functions ---
    async function apiRequest(url, options = {}) {
        showLoading(true);
        listErrorDisplay.textContent = ''; // Clear list errors on new request
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                let errorMsg = `Request failed! Status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) { /* Ignore if response not JSON */ }
                throw new Error(errorMsg);
            }
            // Handle 204 No Content response (like successful DELETE)
            if (response.status === 204) {
                return null; // Or return an indicator of success
            }
            return await response.json(); // Assumes JSON response for GET/POST/PUT
        } catch (error) {
            console.error(`API Request Error (${options.method || 'GET'} ${url}):`, error);
            listErrorDisplay.textContent = `Operation failed: ${error.message}`; // Show error near the list
            throw error; // Re-throw error for calling function to handle if needed
        } finally {
            showLoading(false);
        }
    }

    // Fetch expenses from the server
    async function fetchExpenses() {
        try {
            const data = await apiRequest(API_URL);
            allExpenses = data || []; // Handle null response if API changes
            allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)); // Ensure sorted
            populateCategoryFilter();
            renderFilteredExpenses(); // Use the new filter function
        } catch (error) {
            // Error already displayed by apiRequest
             allExpenses = [];
             renderFilteredExpenses(); // Render empty state
        }
    }

    // --- Rendering Functions ---

    // Render the expense list based on current filters
    function renderFilteredExpenses() {
        const categoryFilter = filterCategorySelect.value;
        const searchTerm = filterSearchInput.value.toLowerCase().trim();

        const filtered = allExpenses.filter(expense => {
            const categoryMatch = categoryFilter === 'All' || expense.category === categoryFilter;
            const searchMatch = searchTerm === '' || expense.description.toLowerCase().includes(searchTerm);
            return categoryMatch && searchMatch;
        });

        renderExpenseList(filtered); // Pass filtered data to the list renderer
        updateChart(filtered); // Update chart with filtered data
    }


    // Renders the actual list items (takes an array of expenses)
    function renderExpenseList(expensesToRender) {
        expenseList.innerHTML = ''; // Clear current list
        let totalExpenses = 0;

        if (expensesToRender.length === 0) {
            noExpensesMessage.style.display = 'block'; // Show 'no expenses' message
        } else {
            noExpensesMessage.style.display = 'none'; // Hide 'no expenses' message
            expensesToRender.forEach(expense => {
                const amountAsNumber = parseFloat(expense.amount);
                if (isNaN(amountAsNumber)) {
                     console.error("Invalid amount in expense ID:", expense.id, expense.amount);
                     return;
                }

                const listItem = document.createElement('li');
                listItem.setAttribute('data-id', expense.id);
                listItem.classList.add('fade-in'); // For animation

                listItem.innerHTML = `
                    <div class="details">
                        <span class="description">${escapeHtml(expense.description)}</span>
                        <span class="category">${escapeHtml(expense.category)}</span>
                        <span class="date">${formatDate(expense.date)}</span>
                    </div>
                    <div class="amount">${CURRENCY_SYMBOL}${amountAsNumber.toFixed(2)}</div>
                    <div class="actions">
                        <button class="btn-edit" title="Edit Expense"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete" title="Delete Expense"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                expenseList.appendChild(listItem);
                totalExpenses += amountAsNumber;
            });
        }
        totalExpensesDisplay.textContent = `${CURRENCY_SYMBOL}${totalExpenses.toFixed(2)}`;
    }

    // Populate category filter dropdown
    function populateCategoryFilter() {
        // ... (keep the previous corrected populateCategoryFilter function) ...
         const categories = new Set(allExpenses.map(exp => exp.category)); // Get unique categories
         const currentFilterValue = filterCategorySelect.value; // Remember current selection

         // Keep the 'All Categories' option, remove others
         while (filterCategorySelect.options.length > 1) {
              filterCategorySelect.remove(1);
         }
         // Add unique categories from fetched data, sorted alphabetically
         Array.from(categories).sort().forEach(category => { // Convert Set to Array to sort
             const option = document.createElement('option');
             option.value = category;
             option.textContent = escapeHtml(category); // Escape category name here too
             filterCategorySelect.appendChild(option);
         });

         // Try to restore previous selection if it still exists
         filterCategorySelect.value = currentFilterValue;
         // If previous selection is gone, default back to 'All'
         if (filterCategorySelect.selectedIndex === -1) {
              filterCategorySelect.value = 'All';
         }
    }

     // --- Chart Functions ---
    function initializeChart() {
        if (!categoryChartCanvas) return;
        const ctx = categoryChartCanvas.getContext('2d');
        categoryChart = new Chart(ctx, {
            type: 'doughnut', // Or 'pie' or 'bar'
            data: {
                labels: [],
                datasets: [{
                    label: 'Expenses by Category',
                    data: [],
                    backgroundColor: [ // Add more colors if needed
                        '#4a90e2', '#50e3c2', '#f5a623', '#bd10e0', '#7ed321',
                        '#f8e71c', '#9013fe', '#417505', '#d0021b', '#b8e986'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom', // Or 'right', 'left', 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += CURRENCY_SYMBOL + context.parsed.toFixed(2);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    function updateChart(expensesForChart) {
        if (!categoryChart) return;

        const categoryTotals = expensesForChart.reduce((acc, expense) => {
            const amount = parseFloat(expense.amount) || 0;
            acc[expense.category] = (acc[expense.category] || 0) + amount;
            return acc;
        }, {});

        const labels = Object.keys(categoryTotals);
        const data = Object.values(categoryTotals);

        categoryChart.data.labels = labels.map(label => escapeHtml(label)); // Escape labels
        categoryChart.data.datasets[0].data = data;
        categoryChart.update();
    }


    // --- Event Handlers ---

    // Handle Add Expense Form Submission
    async function handleAddExpense(event) {
        event.preventDefault();
        formErrorDisplay.textContent = '';
        formSuccessDisplay.style.display = 'none';

        const description = document.getElementById('description').value.trim();
        const amount = document.getElementById('amount').value;
        const category = document.getElementById('category').value;
        const date = document.getElementById('date').value;

        // Client-side validation
        if (!description || !amount || !category || !date) {
             showFeedback(formErrorDisplay, 'Please fill in all fields.', false); return;
        }
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
             showFeedback(formErrorDisplay, 'Amount must be a positive number.', false); return;
        }
         if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
             showFeedback(formErrorDisplay, 'Invalid date format. Use YYYY-MM-DD.', false); return;
         }

        const newExpense = { description, amount: parsedAmount, category, date };

        try {
            const addedExpense = await apiRequest(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newExpense),
            });

            if (addedExpense) {
                allExpenses.push(addedExpense);
                allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)); // Re-sort
                populateCategoryFilter();
                renderFilteredExpenses(); // Use filter renderer
                showFeedback(formSuccessDisplay, 'Expense added successfully!', true);
                expenseForm.reset();
                document.getElementById('date').valueAsDate = new Date(); // Reset date
            }
        } catch (error) {
             showFeedback(formErrorDisplay, error.message, false);
        }
    }

    // Handle clicks on the expense list (for Edit/Delete)
    function handleListClick(event) {
        const deleteButton = event.target.closest('.btn-delete');
        const editButton = event.target.closest('.btn-edit');

        if (deleteButton) {
            const listItem = deleteButton.closest('li');
            const expenseId = listItem.getAttribute('data-id');
            handleDeleteExpense(expenseId, listItem);
        } else if (editButton) {
             const listItem = editButton.closest('li');
             const expenseId = listItem.getAttribute('data-id');
             handleEditClick(expenseId);
        }
    }

    // Handle Delete Expense
    async function handleDeleteExpense(expenseId, listItem) {
        if (!confirm('Are you sure you want to delete this expense?')) {
            return;
        }

        try {
            // Optimistic UI update: Fade out first
            listItem.classList.add('fade-out');

            // Add slight delay for animation before making API call
            await new Promise(resolve => setTimeout(resolve, 300));

            await apiRequest(`${API_URL}/${expenseId}`, { method: 'DELETE' });

            // Remove from local cache ONLY after successful API call
             allExpenses = allExpenses.filter(expense => expense.id !== parseInt(expenseId));
             // No need to remove from DOM again, fade-out implies removal, re-render handles the rest
             populateCategoryFilter();
             renderFilteredExpenses(); // Re-render list and chart

        } catch (error) {
            // If API call failed, remove fade-out class to show item again
             listItem.classList.remove('fade-out');
             // Error message is shown by apiRequest
             showFeedback(listErrorDisplay, `Failed to delete: ${error.message}`, false);
        }
    }

     // Handle Edit Button Click - Open Modal
    function handleEditClick(expenseId) {
        const expenseToEdit = allExpenses.find(exp => exp.id === parseInt(expenseId));
        if (!expenseToEdit) {
            console.error("Expense not found for editing:", expenseId);
            showFeedback(listErrorDisplay, 'Could not find expense data to edit.', false);
            return;
        }

        // Populate the modal form
        editExpenseIdInput.value = expenseToEdit.id;
        editDescriptionInput.value = expenseToEdit.description;
        // Ensure amount is parsed correctly if it's a string in the cache
        editAmountInput.value = parseFloat(expenseToEdit.amount).toFixed(2);
        editCategoryInput.value = expenseToEdit.category;
        editDateInput.value = expenseToEdit.date; // Assumes date is YYYY-MM-DD

        editErrorDisplay.textContent = ''; // Clear previous modal errors
        editModal.style.display = 'block'; // Show the modal
    }

    // Close Edit Modal
    window.closeEditModal = function() { // Make it globally accessible for onclick=""
        editModal.style.display = 'none';
    }

    // Handle Edit Form Submission
    async function handleUpdateExpense(event) {
         event.preventDefault();
         editErrorDisplay.textContent = '';

         const id = editExpenseIdInput.value;
         const description = editDescriptionInput.value.trim();
         const amount = editAmountInput.value;
         const category = editCategoryInput.value;
         const date = editDateInput.value;

        // Client-side validation for edit form
        if (!description || !amount || !category || !date) {
             showFeedback(editErrorDisplay, 'Please fill in all fields.', false); return;
        }
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
             showFeedback(editErrorDisplay, 'Amount must be a positive number.', false); return;
        }
         if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
             showFeedback(editErrorDisplay, 'Invalid date format. Use YYYY-MM-DD.', false); return;
         }

        const updatedExpenseData = { description, amount: parsedAmount, category, date };

        try {
            // **IMPORTANT: This requires a PUT endpoint on your backend: PUT /api/expenses/:id**
            const updatedExpenseFromServer = await apiRequest(`${API_URL}/${id}`, {
                method: 'PUT', // Or 'PATCH' depending on backend implementation
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedExpenseData),
            });

            if (updatedExpenseFromServer) {
                // Update local cache
                const index = allExpenses.findIndex(exp => exp.id === parseInt(id));
                if (index !== -1) {
                    allExpenses[index] = updatedExpenseFromServer;
                } else {
                    allExpenses.push(updatedExpenseFromServer); // Add if somehow missing
                }
                 allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)); // Re-sort

                populateCategoryFilter();
                renderFilteredExpenses();
                closeEditModal();
                 // Optionally show a success message near the list
                 showFeedback(listErrorDisplay, 'Expense updated successfully!', true);

            } else {
                 // Handle case where PUT might not return the updated object
                 // Maybe just refetch all expenses?
                 await fetchExpenses();
                 closeEditModal();
                 showFeedback(listErrorDisplay, 'Expense updated (verification pending).', true);
            }

        } catch (error) {
            showFeedback(editErrorDisplay, error.message, false); // Show error inside modal
        }
    }

    // Debounced search handler
    const handleSearchInput = debounce(() => {
        renderFilteredExpenses();
    }, 300); // 300ms delay after user stops typing

    // --- Event Listeners Setup ---
    expenseForm.addEventListener('submit', handleAddExpense);
    editExpenseForm.addEventListener('submit', handleUpdateExpense);
    expenseList.addEventListener('click', handleListClick); // Use event delegation
    filterCategorySelect.addEventListener('change', renderFilteredExpenses);
    filterSearchInput.addEventListener('input', handleSearchInput);

     // Close modal if clicked outside the content area
     window.addEventListener('click', (event) => {
        if (event.target === editModal) {
            closeEditModal();
        }
    });


    // --- Initial Load ---
    document.getElementById('date').valueAsDate = new Date(); // Set default date to today
    initializeChart(); // Initialize chart structure
    fetchExpenses(); // Load data and initial render
});