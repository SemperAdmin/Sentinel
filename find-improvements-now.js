// Quick script to help locate the improvements section and convert buttons
(function() {
    console.log('🔍 FINDING IMPROVEMENTS SECTION...');
    
    // Look for improvements section
    const improvementsSection = document.querySelector('#notes-tab');
    const improvementsList = document.querySelector('#improvements-list');
    const convertButtons = document.querySelectorAll('[data-action="convert-to-todo"]');
    
    console.log('📋 Improvements section found:', !!improvementsSection);
    console.log('📋 Improvements list found:', !!improvementsList);
    console.log('🔄 Convert buttons found:', convertButtons.length);
    
    if (improvementsSection) {
        console.log('✅ Notes/Improvements tab exists!');
        
        // Make it highly visible
        improvementsSection.style.border = '3px solid #ff0000';
        improvementsSection.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        improvementsSection.style.padding = '20px';
        improvementsSection.style.margin = '10px';
        
        // Scroll to it
        improvementsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight improvements list
        if (improvementsList) {
            improvementsList.style.border = '3px solid #00ff00';
            improvementsList.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
            improvementsList.style.padding = '15px';
            
            // Show what improvements exist
            const improvementItems = improvementsList.querySelectorAll('.improvement-item');
            console.log('📈 Number of improvement items:', improvementItems.length);
            
            improvementItems.forEach((item, index) => {
                const title = item.querySelector('.improvement-title')?.textContent || 'No title';
                const convertBtn = item.querySelector('[data-action="convert-to-todo"]');
                console.log(`${index + 1}. "${title}" - Convert button: ${!!convertBtn}`);
                
                // Highlight each item
                item.style.border = '2px solid #ffff00';
                item.style.margin = '10px 0';
                item.style.padding = '10px';
                
                if (convertBtn) {
                    convertBtn.style.backgroundColor = '#ff00ff';
                    convertBtn.style.color = 'white';
                    convertBtn.style.fontSize = '20px';
                    convertBtn.style.padding = '10px';
                    convertBtn.style.border = '3px solid #ffffff';
                    convertBtn.textContent = '➕ CONVERT TO TODO';
                }
            });
        }
    } else {
        console.log('❌ Notes/Improvements tab not found');
        console.log('Available tabs:', document.querySelectorAll('.tab-btn').length);
        document.querySelectorAll('.tab-btn').forEach((btn, i) => {
            console.log(`${i + 1}. Tab: "${btn.textContent}" - data-tab: ${btn.dataset.tab}`);
        });
    }
    
    // Check if we're on the right tab
    const activeTab = document.querySelector('.tab-btn.active');
    console.log('📝 Active tab:', activeTab?.textContent || 'None');
    
    if (activeTab && activeTab.dataset.tab !== 'notes') {
        console.log('💡 Switch to the NOTES tab to see improvements!');
        
        // Find and highlight the notes tab button
        const notesTabBtn = document.querySelector('[data-tab="notes"]');
        if (notesTabBtn) {
            notesTabBtn.style.backgroundColor = '#ff00ff';
            notesTabBtn.style.color = 'white';
            notesTabBtn.style.fontSize = '16px';
            notesTabBtn.style.padding = '15px';
            notesTabBtn.textContent = '📝 NOTES (CLICK HERE FOR IMPROVEMENTS)';
            
            // Auto-click after 2 seconds
            setTimeout(() => {
                console.log('🔄 Auto-switching to NOTES tab...');
                notesTabBtn.click();
                
                // Re-highlight after tab switch
                setTimeout(() => {
                    const newImprovementsList = document.querySelector('#improvements-list');
                    if (newImprovementsList) {
                        newImprovementsList.style.border = '5px solid #00ffff';
                        newImprovementsList.style.backgroundColor = 'rgba(0, 255, 255, 0.2)';
                    }
                }, 500);
            }, 2000);
        }
    }
    
    console.log('🎯 SCRIPT COMPLETE - Look for highlighted sections!');
})();