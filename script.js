document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expense-form');
    const expenseList = document.getElementById('expense-list');
    const totalExpensesDisplay = document.getElementById('total-expenses');
    const formErrorDisplay = document.getElementById('form-error');
    const listErrorDisplay = document.getElementById('list-error');
    const filterCategorySelect = document.getElementById('filter-category');

    const API_URL = '/api/expenses'; // Our backend endpoint
    const CURRENCY_SYMBOL = '£'; // Change if needed

    let allExpenses = []; // To store fetched expenses for filtering

    // --- Event Listeners ---
    expenseForm.addEventListener('submit', handleAddExpense);
    expenseList.addEventListener('click', handleDeleteExpense); // Event delegation for delete buttons
    filterCategorySelect.addEventListener('change', renderExpenses); // Re-render when filter changes

    // --- Functions ---

    // Fetch expenses from the server
    async function fetchExpenses() {
        listErrorDisplay.textContent = ''; // Clear previous errors
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allExpenses = await response.json();
            populateCategoryFilter();
            renderExpenses(); // Render initially with fetched data
        } catch (error) {
            console.error('Error fetching expenses:', error);
            listErrorDisplay.textContent = 'Failed to load expenses. Please try again later.';
            allExpenses = []; // Reset expenses on error
            renderExpenses(); // Render empty state
        }
    }

    // Render expenses to the list
    function renderExpenses() {
        const selectedCategory = filterCategorySelect.value;
        expenseList.innerHTML = ''; // Clear current list
        let totalExpenses = 0;

        const filteredExpenses = selectedCategory === 'All'
            ? allExpenses
            : allExpenses.filter(expense => expense.category === selectedCategory);

        if (filteredExpenses.length === 0) {
            const noExpensesMsg = document.createElement('li');
            noExpensesMsg.className = 'no-expenses';
            noExpensesMsg.textContent = selectedCategory === 'All'
                ? 'No expenses recorded yet.'
                : `No expenses found for category: ${selectedCategory}`;
            expenseList.appendChild(noExpensesMsg);
        } else {
             // Sort by date descending (most recent first) - server already sorts, but good practice client-side too
            filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

            filteredExpenses.forEach(expense => {
                const listItem = document.createElement('li');
                listItem.setAttribute('data-id', expense.id); // Store ID for deletion

                listItem.innerHTML = `
                    <div class="details">
                        <span class="description">${escapeHtml(expense.description)}</span>
                        <span class="category">Category: ${escapeHtml(expense.category)}</span>
                        <span class="date">Date: ${formatDate(expense.date)}</span>
                    </div>
                    <div class="amount">${CURRENCY_SYMBOL}${expense.amount.toFixed(2)}</div>
                    <div class="actions">
                        <button class="delete-btn">Delete</button>
                    </div>
                `;
                expenseList.appendChild(listItem);
                totalExpenses += expense.amount;
            });
        }

        totalExpensesDisplay.textContent = `${CURRENCY_SYMBOL}${totalExpenses.toFixed(2)}`;
    }

     // Populate category filter dropdown based on existing expenses
    function populateCategoryFilter() {
        const categories = new Set(allExpenses.map(exp => exp.category)); // Get unique categories
        // Keep the 'All Categories' option, remove others
        while (filterCategorySelect.options.length > 1) {
             filterCategorySelect.remove(1);
        }
        // Add unique categories from fetched data
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = escapeHtml(category);
            filterCategorySelect.appendChild(option);
        });
    }


    // Handle form submission to add a new expense
    async function handleAddExpense(event) {
        event.preventDefault(); // Prevent default form submission
        formErrorDisplay.textContent = ''; // Clear previous errors

        const descriptionInput = document.getElementById('description');
        const amountInput = document.getElementById('amount');
        const categoryInput = document.getElementById('category');
        const dateInput = document.getElementById('date');

        const newExpense = {
            description: descriptionInput.value.trim(),
            amount: parseFloat(amountInput.value),
            category: categoryInput.value,
            date: dateInput.value // Expects YYYY-MM-DD format
        };

        // Basic client-side validation (complementary to server-side)
        if (!newExpense.description || !newExpense.amount || !newExpense.category || !newExpense.date) {
            formErrorDisplay.textContent = 'Please fill in all fields.';
            return;
        }
         if (newExpense.amount <= 0) {
            formErrorDisplay.textContent = 'Amount must be positive.';
            return;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newExpense),
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const addedExpense = await response.json();

            // Add to local list and re-render (Optimistic UI update or refetch)
            allExpenses.push(addedExpense); // Add to our local cache
            populateCategoryFilter(); // Update filter if new category added
             // Set filter to 'All' to ensure the new item is visible if it doesn't match current filter
            // filterCategorySelect.value = 'All';
            renderExpenses();


            // Clear the form
            expenseForm.reset();
             // Optionally set date back to today
            dateInput.valueAsDate = new Date();


        } catch (error) {
            console.error('Error adding expense:', error);
            formErrorDisplay.textContent = `Failed to add expense: ${error.message}`;
        }
    }

    // Handle clicking the delete button
    async function handleDeleteExpense(event) {
         // Use event delegation - check if the clicked element is a delete button
        if (!event.target.classList.contains('delete-btn')) {
            return;
        }

        listErrorDisplay.textContent = ''; // Clear previous errors
        const listItem = event.target.closest('li'); // Find the parent list item
        const expenseId = listItem.getAttribute('data-id');

        if (!expenseId) {
            console.error('Could not find expense ID for deletion');
            return;
        }

        if (!confirm('Are you sure you want to delete this expense?')) {
            return; // User cancelled
        }

        try {
            const response = await fetch(`${API_URL}/${expenseId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            // Remove from local list and re-render
            allExpenses = allExpenses.filter(expense => expense.id !== parseInt(expenseId));
            populateCategoryFilter(); // Potentially remove a category from filter
            renderExpenses();

        } catch (error) {
            console.error('Error deleting expense:', error);
            listErrorDisplay.textContent = `Failed to delete expense: ${error.message}`;
        }
    }

    // Helper function to format date (e.g., DD Mon YYYY)
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        // Handle potential invalid date strings gracefully
        try {
            const date = new Date(dateString + 'T00:00:00'); // Ensure it's treated as local date
             if (isNaN(date)) return dateString; // Return original if invalid
            return date.toLocaleDateString('en-GB', options); // Adjust locale as needed
        } catch(e) {
            return dateString; // Return original on error
        }
    }

    // Basic HTML escaping helper
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, """)
             .replace(/'/g, "'");
    }


    // --- Initial Load ---
    document.getElementById('date').valueAsDate = new Date(); // Set default date to today
    fetchExpenses(); // Load existing expenses when the page loads
});