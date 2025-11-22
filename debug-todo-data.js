// Debug script to check todo data flow and visibility
(function() {
    console.log('🔍 DEBUGGING TODO DATA ISSUE...');
    
    // Check current app state
    const currentApp = window.appState?.state?.currentApp;
    console.log('📱 Current app:', currentApp?.id || 'No app selected');
    console.log('📋 Current app todos:', currentApp?.todos || 'No todos array');
    
    if (currentApp) {
        console.log('📊 Todo count:', currentApp.todos?.length || 0);
        if (currentApp.todos?.length > 0) {
            console.log('📝 First todo:', currentApp.todos[0]);
        }
    }
    
    // Check TabbedDetail component
    const tabbedDetail = window.app?.tabbedDetail;
    console.log('🎯 TabbedDetail component:', !!tabbedDetail);
    if (tabbedDetail) {
        console.log('🎯 TabbedDetail app:', tabbedDetail.app?.id);
        console.log('🎯 TabbedDetail todos:', tabbedDetail.app?.todos?.length || 0);
        console.log('🎯 Active tab:', tabbedDetail.activeTab);
    }
    
    // Check DOM elements
    const todoTab = document.querySelector('#todo-tab');
    const activeTodos = document.querySelector('#active-todos');
    const completedTodos = document.querySelector('#completed-todos');
    
    console.log('📄 Todo tab found:', !!todoTab);
    console.log('📄 Active todos container:', !!activeTodos);
    console.log('📄 Completed todos container:', !!completedTodos);
    
    // Check if we're on the right tab
    const activeTabBtn = document.querySelector('.tab-btn.active');
    console.log('📝 Active tab button:', activeTabBtn?.textContent || 'None');
    
    // Force render todo tab if needed
    if (tabbedDetail && currentApp?.todos?.length > 0) {
        console.log('🔄 Forcing todo tab render...');
        tabbedDetail.activeTab = 'todo';
        tabbedDetail.render();
        
        setTimeout(() => {
            const newActiveTodos = document.querySelector('#active-todos');
            console.log('🔄 After render - Active todos content:', newActiveTodos?.innerHTML || 'Empty');
        }, 500);
    }
    
    // Test adding a todo
    window.testAddTodo = function() {
        if (!currentApp) {
            console.log('❌ No app selected');
            return;
        }
        
        const testTodo = {
            id: Date.now().toString(),
            title: 'Test Todo from Debug',
            description: 'This is a test todo added from debug script',
            priority: 'medium',
            dueDate: null,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        if (!currentApp.todos) currentApp.todos = [];
        currentApp.todos.push(testTodo);
        
        // Save via app
        window.app.saveAppData(currentApp.id, currentApp).then(() => {
            console.log('✅ Test todo added and saved!');
            console.log('📊 New todo count:', currentApp.todos.length);
            
            // Force re-render
            if (tabbedDetail) {
                tabbedDetail.render();
            }
        }).catch(err => {
            console.error('❌ Failed to save test todo:', err);
        });
    };
    
    console.log('💡 Run testAddTodo() to add a test todo and see what happens');
})();