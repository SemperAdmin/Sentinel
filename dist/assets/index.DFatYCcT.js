(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))a(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const n of s.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&a(n)}).observe(document,{childList:!0,subtree:!0});function t(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(i){if(i.ep)return;i.ep=!0;const s=t(i);fetch(i.href,s)}})();const B=(r,e)=>e.some(t=>r instanceof t);let k,L;function O(){return k||(k=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function U(){return L||(L=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const x=new WeakMap,w=new WeakMap,P=new WeakMap,v=new WeakMap,I=new WeakMap;function q(r){const e=new Promise((t,a)=>{const i=()=>{r.removeEventListener("success",s),r.removeEventListener("error",n)},s=()=>{t(m(r.result)),i()},n=()=>{a(r.error),i()};r.addEventListener("success",s),r.addEventListener("error",n)});return e.then(t=>{t instanceof IDBCursor&&x.set(t,r)}).catch(()=>{}),I.set(e,r),e}function z(r){if(w.has(r))return;const e=new Promise((t,a)=>{const i=()=>{r.removeEventListener("complete",s),r.removeEventListener("error",n),r.removeEventListener("abort",n)},s=()=>{t(),i()},n=()=>{a(r.error||new DOMException("AbortError","AbortError")),i()};r.addEventListener("complete",s),r.addEventListener("error",n),r.addEventListener("abort",n)});w.set(r,e)}let y={get(r,e,t){if(r instanceof IDBTransaction){if(e==="done")return w.get(r);if(e==="objectStoreNames")return r.objectStoreNames||P.get(r);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return m(r[e])},set(r,e,t){return r[e]=t,!0},has(r,e){return r instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in r}};function V(r){y=r(y)}function _(r){return r===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...t){const a=r.call(g(this),e,...t);return P.set(a,e.sort?e.sort():[e]),m(a)}:U().includes(r)?function(...e){return r.apply(g(this),e),m(x.get(this))}:function(...e){return m(r.apply(g(this),e))}}function G(r){return typeof r=="function"?_(r):(r instanceof IDBTransaction&&z(r),B(r,O())?new Proxy(r,y):r)}function m(r){if(r instanceof IDBRequest)return q(r);if(v.has(r))return v.get(r);const e=G(r);return e!==r&&(v.set(r,e),I.set(e,r)),e}const g=r=>I.get(r);function W(r,e,{blocked:t,upgrade:a,blocking:i,terminated:s}={}){const n=indexedDB.open(r,e),c=m(n);return a&&n.addEventListener("upgradeneeded",o=>{a(m(n.result),o.oldVersion,o.newVersion,m(n.transaction),o)}),t&&n.addEventListener("blocked",o=>t(o.oldVersion,o.newVersion,o)),c.then(o=>{s&&o.addEventListener("close",()=>s()),i&&o.addEventListener("versionchange",d=>i(d.oldVersion,d.newVersion,d))}).catch(()=>{}),c}const j=["get","getKey","getAll","getAllKeys","count"],Y=["put","add","delete","clear"],b=new Map;function C(r,e){if(!(r instanceof IDBDatabase&&!(e in r)&&typeof e=="string"))return;if(b.get(e))return b.get(e);const t=e.replace(/FromIndex$/,""),a=e!==t,i=Y.includes(t);if(!(t in(a?IDBIndex:IDBObjectStore).prototype)||!(i||j.includes(t)))return;const s=async function(n,...c){const o=this.transaction(n,i?"readwrite":"readonly");let d=o.store;return a&&(d=d.index(c.shift())),(await Promise.all([d[t](...c),i&&o.done]))[0]};return b.set(e,s),s}V(r=>({...r,get:(e,t,a)=>C(e,t)||r.get(e,t,a),has:(e,t)=>!!C(e,t)||r.has(e,t)}));const K="APM-Portfolio-Manager",J=1,h="portfolio",p="ideas";class Z{constructor(){this.db=null,this.initialized=!1}async init(){if(!this.initialized)try{this.db=await W(K,J,{upgrade(e){if(!e.objectStoreNames.contains(h)){const t=e.createObjectStore(h,{keyPath:"id"});t.createIndex("status","status"),t.createIndex("nextReviewDate","nextReviewDate")}if(!e.objectStoreNames.contains(p)){const t=e.createObjectStore(p,{keyPath:"id"});t.createIndex("dateCreated","dateCreated"),t.createIndex("riskRating","riskRating")}}}),await this.initializeSampleData(),this.initialized=!0,console.log("DataStore initialized successfully")}catch(e){throw console.error("Failed to initialize DataStore:",e),new Error("Database initialization failed")}}async initializeSampleData(){try{const e=await this.db.count(h),t=await this.db.count(p);if(e===0){const a=[{id:"workout-tracker",repoUrl:"https://api.github.com/repos/user/workout-tracker",platform:"iOS",status:"Active",lastReviewDate:"2025-09-01",nextReviewDate:"2025-12-01",pendingTodos:3,notes:"Decided to use SwiftUI for all views. Need to refactor the workout history screen.",lastCommitDate:null,latestTag:null},{id:"expense-manager",repoUrl:"https://api.github.com/repos/user/expense-manager",platform:"Web",status:"Active",lastReviewDate:"2025-08-15",nextReviewDate:"2025-11-15",pendingTodos:1,notes:"React app with TypeScript. Performance optimization needed for large datasets.",lastCommitDate:null,latestTag:null},{id:"habit-tracker",repoUrl:"https://api.github.com/repos/user/habit-tracker",platform:"Android",status:"Active",lastReviewDate:"2025-07-20",nextReviewDate:"2025-10-20",pendingTodos:5,notes:"Kotlin app using Room database. Need to implement dark mode.",lastCommitDate:null,latestTag:null}];for(const i of a)await this.db.put(h,i)}if(t===0){const a=[{id:"idea-1",conceptName:"Smart Recipe Suggester",problemSolved:"Helps users find recipes based on ingredients they already have at home, reducing food waste.",targetAudience:"Home cooks and busy professionals who want to minimize grocery shopping.",initialFeatures:"Ingredient scanner, recipe matching algorithm, dietary restrictions filter, shopping list generation.",techStack:"React Native",riskRating:"Medium",dateCreated:new Date().toISOString()},{id:"idea-2",conceptName:"Local Event Discovery",problemSolved:"Connects users with local events and activities that match their interests and schedule.",targetAudience:"Young professionals and students looking for social activities and networking opportunities.",initialFeatures:"Event feed, interest matching, calendar integration, social sharing.",techStack:"Flutter",riskRating:"Low",dateCreated:new Date().toISOString()}];for(const i of a)await this.db.put(p,i)}}catch(e){console.error("Failed to initialize sample data:",e)}}async getPortfolio(){this.initialized||await this.init();try{return await this.db.getAll(h)}catch(e){throw console.error("Failed to get portfolio:",e),new Error("Failed to retrieve portfolio data")}}async getApp(e){this.initialized||await this.init();try{return await this.db.get(h,e)}catch(t){throw console.error("Failed to get app:",t),new Error("Failed to retrieve app data")}}async saveApp(e){this.initialized||await this.init();try{return await this.db.put(h,e),e}catch(t){throw console.error("Failed to save app:",t),new Error("Failed to save app data")}}async deleteApp(e){this.initialized||await this.init();try{await this.db.delete(h,e)}catch(t){throw console.error("Failed to delete app:",t),new Error("Failed to delete app")}}async getIdeas(){this.initialized||await this.init();try{return await this.db.getAll(p)}catch(e){throw console.error("Failed to get ideas:",e),new Error("Failed to retrieve ideas data")}}async getIdea(e){this.initialized||await this.init();try{return await this.db.get(p,e)}catch(t){throw console.error("Failed to get idea:",t),new Error("Failed to retrieve idea data")}}async saveIdea(e){this.initialized||await this.init();try{return await this.db.put(p,e),e}catch(t){throw console.error("Failed to save idea:",t),new Error("Failed to save idea data")}}async deleteIdea(e){this.initialized||await this.init();try{await this.db.delete(p,e)}catch(t){throw console.error("Failed to delete idea:",t),new Error("Failed to delete idea")}}async activateIdea(e,t){this.initialized||await this.init();try{const a=await this.getIdea(e);if(!a)throw new Error("Idea not found");const i={id:a.conceptName.toLowerCase().replace(/\s+/g,"-"),repoUrl:t,platform:this.inferPlatform(a.techStack),status:"Active",lastReviewDate:new Date().toISOString().split("T")[0],nextReviewDate:this.calculateNextReviewDate(),pendingTodos:0,notes:`Converted from idea: ${a.conceptName}. Original problem: ${a.problemSolved}`,lastCommitDate:null,latestTag:null};return await this.saveApp(i),await this.deleteIdea(e),i}catch(a){throw console.error("Failed to activate idea:",a),new Error("Failed to activate idea")}}inferPlatform(e){return{"React Native":"Cross-platform",Flutter:"Cross-platform",Web:"Web","iOS Native":"iOS","Android Native":"Android"}[e]||"Unknown"}calculateNextReviewDate(){const e=new Date;return e.setMonth(e.getMonth()+3),e.toISOString().split("T")[0]}async clearAll(){this.initialized||await this.init();try{const e=this.db.transaction([h,p],"readwrite");await e.objectStore(h).clear(),await e.objectStore(p).clear(),await e.done}catch(e){throw console.error("Failed to clear data:",e),new Error("Failed to clear data")}}}const u=new Z;class Q{constructor(){this.baseUrl="https://api.github.com",this.retryAttempts=3,this.retryDelay=1e3,this.maxDelay=3e4}async fetchRepoData(e){if(!e||!e.includes("github.com"))return console.warn("Invalid GitHub repository URL:",e),this.getFallbackData();const t=e.match(/github\.com\/([^\/]+)\/([^\/]+)/);if(!t)return console.warn("Could not parse GitHub repository URL:",e),this.getFallbackData();const[,a,i]=t,s=i.replace(/\.git$/,"");return this.fetchWithRetry(`/repos/${a}/${s}`)}async fetchLastCommit(e,t){return this.fetchWithRetry(`/repos/${e}/${t}/commits`,{per_page:1})}async fetchLatestTag(e,t){return this.fetchWithRetry(`/repos/${e}/${t}/tags`,{per_page:1})}async fetchWithRetry(e,t={}){const a=new URL(`${this.baseUrl}${e}`);Object.keys(t).forEach(s=>{a.searchParams.append(s,t[s])});let i;for(let s=0;s<this.retryAttempts;s++){try{console.log(`API attempt ${s+1} for ${e}`);const n=await this.makeApiRequest(a.toString());if(n.ok){const o=await n.json();return console.log(`API success for ${e}`),o}if(n.status===403&&n.headers.get("X-RateLimit-Remaining")==="0"){const o=n.headers.get("X-RateLimit-Reset"),d=o?parseInt(o)*1e3-Date.now():6e4;console.log(`Rate limited, waiting ${d}ms`),await this.delay(Math.min(d,this.maxDelay));continue}if(n.status===404)return console.warn(`Repository not found: ${e}`),this.getFallbackData();const c=await n.text();console.error(`API error ${n.status}:`,c),i=new Error(`GitHub API error: ${n.status}`)}catch(n){console.error(`API request failed (attempt ${s+1}):`,n),i=n}if(s<this.retryAttempts-1){const n=this.retryDelay*Math.pow(2,s);console.log(`Retrying after ${n}ms`),await this.delay(Math.min(n,this.maxDelay))}}return console.error("All API attempts failed, returning fallback data"),this.getFallbackData()}async makeApiRequest(e){const t={Accept:"application/vnd.github.v3+json","User-Agent":"APM-Portfolio-Manager/1.0"};return window.GITHUB_API_KEY&&window.GITHUB_API_KEY!=="YOUR_API_KEY_HERE"&&(t.Authorization=`token ${window.GITHUB_API_KEY}`),fetch(e,{method:"GET",headers:t,mode:"cors"})}async getComprehensiveRepoData(e){try{const t=await this.fetchRepoData(e);if(t.isFallback)return t;const[a,i]=await Promise.allSettled([this.fetchLastCommit(t.owner.login,t.name),this.fetchLatestTag(t.owner.login,t.name)]);return{id:t.full_name.replace("/","-"),name:t.name,fullName:t.full_name,description:t.description,lastCommitDate:a.status==="fulfilled"&&a.value[0]?a.value[0].commit.author.date:null,latestTag:i.status==="fulfilled"&&i.value[0]?i.value[0].name:null,stars:t.stargazers_count,language:t.language,isPrivate:t.private,archived:t.archived,updatedAt:t.updated_at,url:t.html_url,isFallback:!1}}catch(t){return console.error("Failed to get comprehensive repo data:",t),this.getFallbackData()}}getFallbackData(){return{id:"unknown-repo",name:"Unknown Repository",fullName:"user/unknown-repo",description:"Repository data unavailable - API access failed or repo not found",lastCommitDate:null,latestTag:null,stars:0,language:"Unknown",isPrivate:!1,archived:!1,updatedAt:null,url:"#",isFallback:!0}}isApiKeyConfigured(){return window.GITHUB_API_KEY&&window.GITHUB_API_KEY!=="YOUR_API_KEY_HERE"}async getRateLimitStatus(){try{const e=await this.makeApiRequest(`${this.baseUrl}/rate_limit`);return e.ok?await e.json():null}catch(e){return console.error("Failed to get rate limit status:",e),null}}delay(e){return new Promise(t=>setTimeout(t,e))}validateRepoUrl(e){return!e||typeof e!="string"?!1:/^https?:\/\/github\.com\/[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+\/?$/.test(e)}extractRepoInfo(e){if(!this.validateRepoUrl(e))return null;const t=e.match(/github\.com\/([^\/]+)\/([^\/]+)/);return t?{owner:t[1],repo:t[2].replace(/\.git$/,""),apiUrl:`https://api.github.com/repos/${t[1]}/${t[2].replace(/\.git$/,"")}`}:null}}const R=new Q;class X{constructor(){this.state={currentView:"dashboard",portfolio:[],portfolioLoading:!1,portfolioError:null,currentApp:null,currentAppLoading:!1,currentAppError:null,ideas:[],ideasLoading:!1,ideasError:null,loading:!1,error:null,activeTab:"overview",showIdeaForm:!1,editingIdea:null},this.listeners=new Set,this.initialized=!1}subscribe(e){return this.listeners.add(e),()=>{this.listeners.delete(e)}}notify(){this.listeners.forEach(e=>{try{e(this.state)}catch(t){console.error("Error in state listener:",t)}})}getState(){return{...this.state}}setState(e){const t=this.state;this.state={...this.state,...e},JSON.stringify(t)!==JSON.stringify(this.state)&&this.notify()}setView(e){if(!["dashboard","detail","ideas"].includes(e)){console.warn("Invalid view:",e);return}this.setState({currentView:e,error:null})}setCurrentApp(e){this.setState({currentApp:e,currentAppError:null})}setActiveTab(e){if(!["overview","todo","notes"].includes(e)){console.warn("Invalid tab:",e);return}this.setState({activeTab:e})}setLoading(e,t=null){t?this.setState({[t]:e}):this.setState({loading:e})}setError(e,t=null){t?this.setState({[t]:e}):this.setState({error:e}),setTimeout(()=>{t?this.setState({[t]:null}):this.setState({error:null})},5e3)}clearError(e=null){e?this.setState({[e]:null}):this.setState({error:null})}setPortfolio(e){this.setState({portfolio:e||[],portfolioLoading:!1,portfolioError:null})}updateApp(e){const t=this.state.portfolio.map(a=>a.id===e.id?e:a);this.setState({portfolio:t})}addApp(e){const t=[...this.state.portfolio,e];this.setState({portfolio:t})}removeApp(e){const t=this.state.portfolio.filter(a=>a.id!==e);this.setState({portfolio:t})}setIdeas(e){this.setState({ideas:e||[],ideasLoading:!1,ideasError:null})}addIdea(e){const t=[...this.state.ideas,e];this.setState({ideas:t})}updateIdea(e){const t=this.state.ideas.map(a=>a.id===e.id?e:a);this.setState({ideas:t})}removeIdea(e){const t=this.state.ideas.filter(a=>a.id!==e);this.setState({ideas:t})}setShowIdeaForm(e,t=null){this.setState({showIdeaForm:e,editingIdea:t})}getComputed(){const{portfolio:e,ideas:t}=this.state;return{totalApps:e.length,activeApps:e.filter(a=>a.status==="Active").length,archivedApps:e.filter(a=>a.status==="Archived").length,overdueReviews:e.filter(a=>a.nextReviewDate?new Date(a.nextReviewDate)<new Date:!1).length,healthyApps:e.filter(a=>this.calculateHealth(a)==="good").length,warningApps:e.filter(a=>this.calculateHealth(a)==="warning").length,criticalApps:e.filter(a=>this.calculateHealth(a)==="critical").length,totalIdeas:t.length,lowRiskIdeas:t.filter(a=>a.riskRating==="Low").length,mediumRiskIdeas:t.filter(a=>a.riskRating==="Medium").length,highRiskIdeas:t.filter(a=>a.riskRating==="High").length}}calculateHealth(e){if(!e.lastCommitDate&&!e.nextReviewDate)return"warning";let t=0;if(e.lastCommitDate){const a=Math.floor((new Date-new Date(e.lastCommitDate))/864e5);a>90?t+=2:a>60&&(t+=1)}if(e.nextReviewDate){const a=Math.floor((new Date(e.nextReviewDate)-new Date)/864e5);a<0?t+=2:a<14&&(t+=1)}return e.pendingTodos>5&&(t+=1),t>=3?"critical":t>=1?"warning":"good"}getAppById(e){return this.state.portfolio.find(t=>t.id===e)}getIdeaById(e){return this.state.ideas.find(t=>t.id===e)}reset(){this.state={currentView:"dashboard",portfolio:[],portfolioLoading:!1,portfolioError:null,currentApp:null,currentAppLoading:!1,currentAppError:null,ideas:[],ideasLoading:!1,ideasError:null,loading:!1,error:null,activeTab:"overview",showIdeaForm:!1,editingIdea:null},this.notify()}debug(){console.log("Current AppState:",this.state),console.log("Computed stats:",this.getComputed())}}const l=new X;function f(r,e={}){if(!r)return"Never";try{const t=new Date(r),i=Math.abs(new Date-t),s=Math.ceil(i/(1e3*60*60*24));return e.relative?s===0?"Today":s===1?"Yesterday":s<7?`${s} days ago`:s<30?`${Math.floor(s/7)} weeks ago`:s<365?`${Math.floor(s/30)} months ago`:`${Math.floor(s/365)} years ago`:t.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric",...e})}catch(t){return console.error("Error formatting date:",t),"Invalid date"}}function F(r,e){try{const t=new Date(r),a=new Date(e),i=Math.abs(a-t);return Math.ceil(i/(1e3*60*60*24))}catch(t){return console.error("Error calculating days between dates:",t),0}}function M(r){if(!r)return"warning";let e=0;const t=new Date;if(r.lastCommitDate){const a=F(r.lastCommitDate,t);a>90?e+=3:a>60?e+=2:a>30&&(e+=1)}else e+=2;if(r.nextReviewDate){const a=F(t,r.nextReviewDate);a<0?e+=3:a<14?e+=2:a<30&&(e+=1)}else e+=1;return r.pendingTodos>5?e+=2:r.pendingTodos>2&&(e+=1),e>=6?"critical":e>=3?"warning":"good"}function H(r){const e={good:"#28a745",warning:"#ffc107",critical:"#dc3545"};return e[r]||e.warning}function ee(r="item"){return`${r}-${Date.now()}-${Math.random().toString(36).substr(2,9)}`}function $(r){return!r||typeof r!="string"?!1:/^https?:\/\/github\.com\/[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+\/?$/.test(r)}class N{constructor(e,t){this.app=e,this.onClick=t,this.element=null}render(){const e=M(this.app),t=H(e),a=document.createElement("div");return a.className="app-card",a.onclick=()=>this.onClick(this.app),a.innerHTML=`
      <div class="app-card-header">
        <h3 class="app-card-title">
          <span class="health-indicator" style="background-color: ${t}"></span>
          ${this.escapeHtml(this.app.id)}
        </h3>
        <span class="app-card-platform">${this.escapeHtml(this.app.platform)}</span>
      </div>
      
      <div class="app-card-metrics">
        <div class="metric-item">
          <span class="metric-label">Current Version:</span>
          <span class="metric-value">${this.escapeHtml(this.app.latestTag||"N/A")}</span>
        </div>
        
        <div class="metric-item">
          <span class="metric-label">Last Commit:</span>
          <span class="metric-value">${f(this.app.lastCommitDate,{relative:!0})}</span>
        </div>
        
        <div class="metric-item">
          <span class="metric-label">Next Review:</span>
          <span class="metric-value">
            ${this.formatReviewDate(this.app.nextReviewDate)}
          </span>
        </div>
        
        <div class="metric-item">
          <span class="metric-label">Pending To-Dos:</span>
          <span class="metric-value">${this.app.pendingTodos||0}</span>
        </div>
      </div>
      
      <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
        Manage App
      </button>
    `,this.element=a,a}formatReviewDate(e){if(!e)return"Not scheduled";const t=new Date(e),i=Math.ceil((t-new Date)/(1e3*60*60*24));return i<0?`<span style="color: #dc3545; font-weight: 600;">Overdue (${Math.abs(i)} days)</span>`:i<=14?`<span style="color: #ffc107; font-weight: 600;">Due soon (${i} days)</span>`:f(e)}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}update(e){if(this.app=e,this.element){const t=this.render();this.element.replaceWith(t),this.element=t}}destroy(){this.element&&this.element.parentNode&&this.element.parentNode.removeChild(this.element)}}class te{constructor(e,t){this.container=e,this.onAppClick=t,this.cards=new Map}render(e){if(this.clear(),!e||e.length===0){this.showEmptyState();return}e.forEach(t=>{const a=new N(t,this.onAppClick),i=a.render();this.container.appendChild(i),this.cards.set(t.id,a)})}updateApp(e){const t=this.cards.get(e.id);t&&t.update(e)}addApp(e){const t=new N(e,this.onAppClick),a=t.render();this.container.appendChild(a),this.cards.set(e.id,t)}removeApp(e){const t=this.cards.get(e);t&&(t.destroy(),this.cards.delete(e))}showEmptyState(){this.container.innerHTML=`
      <div style="text-align: center; padding: 3rem; color: #6c757d;">
        <h3>No apps in portfolio</h3>
        <p>Start by adding some apps or creating new ideas.</p>
      </div>
    `}clear(){this.cards.forEach(e=>e.destroy()),this.cards.clear(),this.container.innerHTML=""}}class ae{constructor(e,t,a){this.app=e,this.onNotesSave=t,this.onTabChange=a,this.element=null,this.activeTab="overview"}render(){const e=document.createElement("div");return e.className="tabbed-detail",e.innerHTML=`
      <!-- Tab Navigation -->
      <div class="tab-nav">
        <button class="tab-btn ${this.activeTab==="overview"?"active":""}" data-tab="overview">
          Overview & System Checks
        </button>
        <button class="tab-btn ${this.activeTab==="todo"?"active":""}" data-tab="todo">
          To-Do & Improvements
        </button>
        <button class="tab-btn ${this.activeTab==="notes"?"active":""}" data-tab="notes">
          Developer Notes
        </button>
      </div>
      
      <!-- Tab Content -->
      <div class="tab-content">
        ${this.renderTabContent()}
      </div>
    `,this.element=e,this.attachEventListeners(),e}renderTabContent(){switch(this.activeTab){case"overview":return this.renderOverviewTab();case"todo":return this.renderTodoTab();case"notes":return this.renderNotesTab();default:return this.renderOverviewTab()}}renderOverviewTab(){const e=M(this.app),t=H(e),a=this.app.nextReviewDate&&new Date(this.app.nextReviewDate)<new Date;return`
      <div id="overview-tab" class="tab-pane active">
        <div class="detail-section">
          <h3>Quarterly Review Schedule</h3>
          <div class="review-info">
            <div class="info-item">
              <label>Last Review:</label>
              <span>${f(this.app.lastReviewDate)||"Never"}</span>
            </div>
            <div class="info-item">
              <label>Next Due:</label>
              <span style="color: ${a?"#dc3545":"inherit"}; font-weight: ${a?"600":"normal"}">
                ${f(this.app.nextReviewDate)||"Not scheduled"}
                ${a?" (OVERDUE)":""}
              </span>
            </div>
          </div>
          <button class="btn btn-primary" id="start-review-checklist" style="margin-top: 1rem;">
            ▶ Start Review Checklist
          </button>
        </div>
        
        <div class="detail-section">
          <h3>Technical Status</h3>
          <div class="status-grid">
            <div class="status-item">
              <label>Health Status:</label>
              <span class="status-badge" style="background-color: ${t}; color: white;">
                ${e.toUpperCase()}
              </span>
            </div>
            <div class="status-item">
              <label>Last Commit:</label>
              <span>${f(this.app.lastCommitDate,{relative:!0})||"Unknown"}</span>
            </div>
            <div class="status-item">
              <label>Latest Version:</label>
              <span>${this.escapeHtml(this.app.latestTag||"None")}</span>
            </div>
            <div class="status-item">
              <label>Platform:</label>
              <span>${this.escapeHtml(this.app.platform)}</span>
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <h3>Repository Information</h3>
          <div class="status-grid">
            <div class="status-item">
              <label>Repository:</label>
              <span>${this.escapeHtml(this.app.repoUrl||"Not linked")}</span>
            </div>
            <div class="status-item">
              <label>Status:</label>
              <span class="status-badge ${this.app.status==="Active"?"status-good":"status-warning"}">
                ${this.app.status}
              </span>
            </div>
            <div class="status-item">
              <label>Pending Tasks:</label>
              <span>${this.app.pendingTodos||0}</span>
            </div>
          </div>
        </div>
      </div>
    `}renderTodoTab(){const e=Math.min((this.app.pendingTodos||0)/4*100,100);return`
      <div id="todo-tab" class="tab-pane">
        <div class="detail-section">
          <h3>Improvement Budget Tracker</h3>
          <div class="budget-info">
            <div class="budget-bar">
              <div class="budget-fill" style="width: ${e}%"></div>
            </div>
            <span id="budget-text">${Math.round(e)}% of 20% budget used</span>
          </div>
          <p style="color: #6c757d; font-size: 0.875rem; margin-top: 0.5rem;">
            This sprint's allocation for technical debt and maintenance improvements
          </p>
        </div>
        
        <div class="detail-section">
          <h3>Open Tasks</h3>
          <div id="task-list" class="task-list">
            ${this.renderTaskList()}
          </div>
          <button class="btn btn-secondary" id="view-external-tracker" style="margin-top: 1rem;">
            🔗 View External Task Tracker
          </button>
        </div>
        
        <div class="detail-section">
          <h3>Quick Actions</h3>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <button class="btn btn-secondary">Add New Task</button>
            <button class="btn btn-secondary">Mark All Complete</button>
            <button class="btn btn-secondary">Export Tasks</button>
          </div>
        </div>
      </div>
    `}renderTaskList(){const e=this.generateSimulatedTasks();return e.length===0?'<p style="color: #6c757d; text-align: center; padding: 2rem;">No tasks found</p>':e.map(t=>`
      <div class="task-item">
        <div>
          <span class="task-priority priority-${t.priority.toLowerCase()}">${t.priority}</span>
          <strong>${this.escapeHtml(t.title)}</strong>
        </div>
        <div>
          <span class="task-tag">${this.escapeHtml(t.tag)}</span>
        </div>
      </div>
    `).join("")}generateSimulatedTasks(){const e=Math.min(this.app.pendingTodos||0,5),t=[],a=[{title:"Update dependencies to latest versions",tag:"Tech Debt",priority:"P1"},{title:"Fix performance issues in main screen",tag:"Bug",priority:"P0"},{title:"Add unit tests for authentication module",tag:"Testing",priority:"P2"},{title:"Refactor legacy code in data layer",tag:"Tech Debt",priority:"P1"},{title:"Update app icon and splash screen",tag:"UI/UX",priority:"P2"},{title:"Implement dark mode support",tag:"Feature",priority:"P1"},{title:"Optimize database queries",tag:"Performance",priority:"P0"},{title:"Add error logging and analytics",tag:"Monitoring",priority:"P2"}];for(let i=0;i<e;i++){const s=a[i%a.length];t.push({...s,id:`task-${i}`,title:`${s.title} - ${this.app.id}`})}return t}renderNotesTab(){return`
      <div id="notes-tab" class="tab-pane">
        <div class="detail-section">
          <h3>Developer Notes</h3>
          <textarea 
            id="developer-notes" 
            class="notes-textarea" 
            placeholder="Add your development notes here... Use this space to document decisions, technical considerations, and future plans.">${this.escapeHtml(this.app.notes||"")}</textarea>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <span style="color: #6c757d; font-size: 0.875rem;">
              ${this.app.notes?this.app.notes.length:0} characters
            </span>
            <button class="btn btn-primary" id="save-notes">
              💾 Save Notes
            </button>
          </div>
        </div>
        
        <div class="detail-section">
          <h3>Quick Templates</h3>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary" data-template="decision">Decision Template</button>
            <button class="btn btn-secondary" data-template="technical">Technical Notes</button>
            <button class="btn btn-secondary" data-template="todo">Future TODO</button>
            <button class="btn btn-secondary" data-template="bug">Bug Report</button>
          </div>
        </div>
      </div>
    `}attachEventListeners(){if(!this.element)return;this.element.querySelectorAll(".tab-btn").forEach(n=>{n.addEventListener("click",c=>{const o=c.target.dataset.tab;this.switchTab(o)})});const t=this.element.querySelector("#start-review-checklist");t&&t.addEventListener("click",()=>{this.startReviewChecklist()});const a=this.element.querySelector("#view-external-tracker");a&&a.addEventListener("click",()=>{this.viewExternalTracker()});const i=this.element.querySelector("#save-notes");i&&i.addEventListener("click",()=>{this.saveNotes()}),this.element.querySelectorAll("[data-template]").forEach(n=>{n.addEventListener("click",c=>{const o=c.target.dataset.template;this.insertTemplate(o)})})}switchTab(e){this.activeTab=e,this.element.querySelectorAll(".tab-btn").forEach(i=>{i.classList.toggle("active",i.dataset.tab===e)});const a=this.element.querySelector(".tab-content");a.innerHTML=this.renderTabContent(),this.attachEventListeners(),this.onTabChange&&this.onTabChange(e)}startReviewChecklist(){console.log("Starting review checklist for:",this.app.id),alert(`Review checklist started for ${this.app.id}

This would typically open a detailed checklist with items like:
- Code quality review
- Security audit
- Performance analysis
- Dependency updates
- Documentation review`)}viewExternalTracker(){console.log("Opening external task tracker for:",this.app.id),alert(`Opening external task tracker for ${this.app.id}

This would typically open your preferred task management tool (Jira, Trello, GitHub Issues, etc.)`)}saveNotes(){const e=this.element.querySelector("#developer-notes");if(e&&this.onNotesSave){const t=e.value;this.onNotesSave(t);const a=this.element.querySelector("#save-notes"),i=a.innerHTML;a.innerHTML="✅ Saved!",a.disabled=!0,setTimeout(()=>{a.innerHTML=i,a.disabled=!1},2e3)}}insertTemplate(e){const t=this.element.querySelector("#developer-notes");if(!t)return;const i={decision:`## Decision Made

**Date:** ${new Date().toLocaleDateString()}

**Context:** 
[Describe the situation that required a decision]

**Decision:** 
[What was decided]

**Rationale:** 
[Why this decision was made]

**Impact:** 
[Expected consequences and next steps]

---

`,technical:`## Technical Notes

**Component:** 
[Which part of the system]

**Implementation Details:** 
[Technical details about the implementation]

**Considerations:** 
[Important technical considerations]

**Potential Issues:** 
[Any known limitations or potential problems]

---

`,todo:`## TODO

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

**Priority:** Medium
**Estimated Effort:** 
**Dependencies:** 

---

`,bug:`## Bug Report

**Date:** ${new Date().toLocaleDateString()}

**Description:** 
[Describe the bug]

**Steps to Reproduce:** 
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:** 
[What should happen]

**Actual Behavior:** 
[What actually happens]

**Severity:** Medium
**Status:** Open

---

`}[e]||"",s=t.selectionStart,n=t.value.substring(0,s),c=t.value.substring(s);t.value=n+i+c,t.focus();const o=s+i.length;t.setSelectionRange(o,o),t.dispatchEvent(new Event("input"))}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}update(e){if(this.app=e,this.element){const t=this.render();this.element.replaceWith(t),this.element=t}}destroy(){this.element&&this.element.parentNode&&this.element.parentNode.removeChild(this.element)}}class ie{constructor(e,t,a=null){this.onSave=e,this.onCancel=t,this.editingIdea=a,this.element=null,this.formData={}}render(){var t,a,i,s,n,c,o,d,D,E,T,A;const e=document.createElement("div");return e.className="idea-form-container",e.innerHTML=`
      <h3>${this.editingIdea?"Edit Idea":"Document New Concept"}</h3>
      <form id="idea-form" class="idea-form">
        <div class="form-group">
          <label for="concept-name">Concept Name *</label>
          <input 
            type="text" 
            id="concept-name" 
            name="conceptName"
            value="${this.escapeHtml(((t=this.editingIdea)==null?void 0:t.conceptName)||"")}"
            required 
            placeholder="Enter a descriptive name for your concept"
          >
        </div>
        
        <div class="form-group">
          <label for="problem-solved">Problem Solved *</label>
          <textarea 
            id="problem-solved" 
            name="problemSolved"
            required 
            placeholder="What value proposition does this idea offer? Describe the problem you're solving..."
            rows="3"
          >${this.escapeHtml(((a=this.editingIdea)==null?void 0:a.problemSolved)||"")}</textarea>
        </div>
        
        <div class="form-group">
          <label for="target-audience">Target Audience *</label>
          <input 
            type="text" 
            id="target-audience" 
            name="targetAudience"
            value="${this.escapeHtml(((i=this.editingIdea)==null?void 0:i.targetAudience)||"")}"
            required 
            placeholder="Who will use this app? (e.g., busy professionals, students, parents)"
          >
        </div>
        
        <div class="form-group">
          <label for="initial-features">Initial Feature Set (MVP) *</label>
          <textarea 
            id="initial-features" 
            name="initialFeatures"
            required 
            placeholder="Define the scope for the minimum viable product. What are the core features needed for launch?"
            rows="4"
          >${this.escapeHtml(((s=this.editingIdea)==null?void 0:s.initialFeatures)||"")}</textarea>
        </div>
        
        <div class="form-group">
          <label for="tech-stack">Technology Stack (Proposed) *</label>
          <select id="tech-stack" name="techStack" required>
            <option value="">Select Technology</option>
            <option value="React Native" ${((n=this.editingIdea)==null?void 0:n.techStack)==="React Native"?"selected":""}>
              React Native
            </option>
            <option value="Flutter" ${((c=this.editingIdea)==null?void 0:c.techStack)==="Flutter"?"selected":""}>
              Flutter
            </option>
            <option value="Web" ${((o=this.editingIdea)==null?void 0:o.techStack)==="Web"?"selected":""}>
              Web (React/Vue/Angular)
            </option>
            <option value="iOS Native" ${((d=this.editingIdea)==null?void 0:d.techStack)==="iOS Native"?"selected":""}>
              iOS Native (Swift)
            </option>
            <option value="Android Native" ${((D=this.editingIdea)==null?void 0:D.techStack)==="Android Native"?"selected":""}>
              Android Native (Kotlin/Java)
            </option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="risk-rating">Risk/Complexity Rating *</label>
          <select id="risk-rating" name="riskRating" required>
            <option value="">Select Rating</option>
            <option value="Low" ${((E=this.editingIdea)==null?void 0:E.riskRating)==="Low"?"selected":""}>
              Low - Straightforward implementation
            </option>
            <option value="Medium" ${((T=this.editingIdea)==null?void 0:T.riskRating)==="Medium"?"selected":""}>
              Medium - Some technical challenges
            </option>
            <option value="High" ${((A=this.editingIdea)==null?void 0:A.riskRating)==="High"?"selected":""}>
              High - Complex or risky implementation
            </option>
          </select>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="cancel-idea">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            ${this.editingIdea?"Update Idea":"Save Idea"}
          </button>
        </div>
      </form>
    `,this.element=e,this.attachEventListeners(),e}attachEventListeners(){if(!this.element)return;this.element.querySelector("#idea-form").addEventListener("submit",s=>{s.preventDefault(),this.handleSubmit()}),this.element.querySelector("#cancel-idea").addEventListener("click",()=>{this.handleCancel()}),this.element.querySelectorAll("input, textarea, select").forEach(s=>{s.addEventListener("input",()=>{this.validateField(s)}),s.addEventListener("blur",()=>{this.validateField(s)})}),this.element.querySelectorAll("textarea").forEach(s=>{this.addCharacterCounter(s)})}handleSubmit(){const e=this.collectFormData();if(!this.validateForm(e))return;const t=this.editingIdea?{...this.editingIdea,...e}:{...e,id:ee("idea"),dateCreated:new Date().toISOString()};this.onSave&&this.onSave(t)}handleCancel(){this.onCancel&&this.onCancel()}collectFormData(){const e=this.element.querySelector("#idea-form"),t=new FormData(e);return{conceptName:t.get("conceptName").trim(),problemSolved:t.get("problemSolved").trim(),targetAudience:t.get("targetAudience").trim(),initialFeatures:t.get("initialFeatures").trim(),techStack:t.get("techStack"),riskRating:t.get("riskRating")}}validateForm(e){const t=[];return Object.keys(e).forEach(a=>{e[a]||t.push(`${this.getFieldLabel(a)} is required`)}),e.conceptName&&e.conceptName.length<3&&t.push("Concept name must be at least 3 characters"),e.conceptName&&e.conceptName.length>100&&t.push("Concept name must not exceed 100 characters"),e.problemSolved&&e.problemSolved.length<10&&t.push("Problem description must be at least 10 characters"),e.initialFeatures&&e.initialFeatures.length<10&&t.push("Feature description must be at least 10 characters"),t.length>0?(this.displayErrors(t),!1):!0}validateField(e){const t=e.value.trim(),a=e.name,i=e.parentNode.querySelector(".field-error");i&&i.remove(),e.classList.remove("field-invalid");let s=null;if(!t&&e.hasAttribute("required")?s=`${this.getFieldLabel(a)} is required`:a==="conceptName"?(t.length<3&&(s="Must be at least 3 characters"),t.length>100&&(s="Must not exceed 100 characters")):(a==="problemSolved"||a==="initialFeatures")&&t.length<10&&(s="Must be at least 10 characters"),s){e.classList.add("field-invalid");const n=document.createElement("div");return n.className="field-error",n.style.color="#dc3545",n.style.fontSize="0.875rem",n.style.marginTop="0.25rem",n.textContent=s,e.parentNode.appendChild(n),!1}return!0}displayErrors(e){const t=this.element.querySelector(".error-summary");t&&t.remove();const a=document.createElement("div");a.className="error-summary",a.style.backgroundColor="#f8d7da",a.style.border="1px solid #f5c6cb",a.style.color="#721c24",a.style.padding="1rem",a.style.borderRadius="4px",a.style.marginBottom="1rem",a.innerHTML=`
      <strong>Please fix the following errors:</strong>
      <ul style="margin-top: 0.5rem; margin-bottom: 0;">
        ${e.map(s=>`<li>${this.escapeHtml(s)}</li>`).join("")}
      </ul>
    `;const i=this.element.querySelector("#idea-form");i.insertBefore(a,i.firstChild),setTimeout(()=>{a.parentNode&&a.remove()},5e3)}addCharacterCounter(e){const t=document.createElement("div");t.className="character-counter",t.style.textAlign="right",t.style.fontSize="0.875rem",t.style.color="#6c757d",t.style.marginTop="0.25rem";const a=()=>{const i=e.value.length;t.textContent=`${i} characters`,i>500?t.style.color="#dc3545":i>300?t.style.color="#ffc107":t.style.color="#6c757d"};e.addEventListener("input",a),a(),e.parentNode.appendChild(t)}getFieldLabel(e){return{conceptName:"Concept Name",problemSolved:"Problem Solved",targetAudience:"Target Audience",initialFeatures:"Initial Features",techStack:"Technology Stack",riskRating:"Risk Rating"}[e]||e}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}getFormData(){return this.collectFormData()}setFormData(e){Object.keys(e).forEach(t=>{const a=this.element.querySelector(`[name="${t}"]`);a&&(a.value=e[t],this.validateField(a))})}validate(){const e=this.collectFormData();return this.validateForm(e)}reset(){this.element.querySelector("#idea-form").reset(),this.element.querySelectorAll(".field-error, .error-summary").forEach(i=>i.remove()),this.element.querySelectorAll(".field-invalid").forEach(i=>i.classList.remove("field-invalid"))}destroy(){this.element&&this.element.parentNode&&this.element.parentNode.removeChild(this.element)}}class re{constructor(){this.appGrid=null,this.tabbedDetail=null,this.ideaForm=null,this.initialized=!1}async init(){try{this.showLoading("Initializing application..."),await u.init(),this.setupEventListeners(),this.subscribeToState(),await this.loadInitialData(),this.showView("dashboard"),this.hideLoading(),this.initialized=!0,console.log("Sentinel initialized successfully")}catch(e){console.error("Failed to initialize application:",e),this.showError("Failed to initialize application. Please refresh the page."),this.hideLoading()}}setupEventListeners(){document.querySelectorAll(".nav-btn").forEach(s=>{s.addEventListener("click",n=>{const c=n.target.dataset.view;c&&this.showView(c)})});const e=document.getElementById("back-to-dashboard");e&&e.addEventListener("click",()=>{this.showView("dashboard")});const t=document.getElementById("refresh-portfolio");t&&t.addEventListener("click",()=>{this.refreshPortfolio()});const a=document.getElementById("new-idea-btn");a&&a.addEventListener("click",()=>{this.showIdeaForm()});const i=document.getElementById("close-error");i&&i.addEventListener("click",()=>{this.hideError()}),window.addEventListener("error",s=>{console.error("Global error:",s.error),this.showError("An unexpected error occurred. Please check the console for details.")}),window.addEventListener("popstate",s=>{s.state&&s.state.view&&this.showView(s.state.view,!1)})}subscribeToState(){l.subscribe(e=>{this.handleStateChange(e)})}handleStateChange(e){switch(document.querySelectorAll(".nav-btn").forEach(t=>{t.classList.toggle("active",t.dataset.view===e.currentView)}),document.querySelectorAll(".view").forEach(t=>{t.classList.toggle("active",t.id===`${e.currentView}-view`)}),e.loading?this.showLoading():this.hideLoading(),e.error&&this.showError(e.error),e.currentView){case"dashboard":this.updateDashboard(e);break;case"detail":this.updateDetailView(e);break;case"ideas":this.updateIdeasView(e);break}}async loadInitialData(){try{const e=await u.getPortfolio();l.setPortfolio(e);const t=await u.getIdeas();l.setIdeas(t),this.fetchGitHubDataForApps(e)}catch(e){console.error("Failed to load initial data:",e),l.setError("Failed to load portfolio data")}}async fetchGitHubDataForApps(e){if(!(!e||e.length===0)){if(!R.isApiKeyConfigured()){console.warn("GitHub API key not configured. Using fallback data.");return}for(let t=0;t<e.length;t++){const a=e[t];if(a.repoUrl&&$(a.repoUrl))try{t>0&&await new Promise(n=>setTimeout(n,1e3));const i=await R.getComprehensiveRepoData(a.repoUrl),s={...a,lastCommitDate:i.lastCommitDate,latestTag:i.latestTag,description:i.description||a.description};await u.saveApp(s),l.updateApp(s)}catch(i){console.error(`Failed to fetch GitHub data for ${a.id}:`,i)}}}}showView(e,t=!0){l.setView(e),t&&history.pushState({view:e},"",`#${e}`)}updateDashboard(e){const t=document.getElementById("app-grid");t&&(this.appGrid||(this.appGrid=new te(t,a=>{this.showAppDetail(a)})),this.appGrid.render(e.portfolio))}updateDetailView(e){const t=document.querySelector(".detail-content");if(!t||!e.currentApp)return;const a=document.getElementById("detail-app-name");a&&(a.textContent=e.currentApp.id),this.tabbedDetail?this.tabbedDetail.update(e.currentApp):(this.tabbedDetail=new ae(e.currentApp,i=>this.saveDeveloperNotes(e.currentApp.id,i),i=>l.setActiveTab(i)),t.innerHTML="",t.appendChild(this.tabbedDetail.render())),this.tabbedDetail.activeTab!==e.activeTab&&this.tabbedDetail.switchTab(e.activeTab)}updateIdeasView(e){const t=document.getElementById("ideas-list");if(!t)return;this.renderIdeasList(e.ideas,t);const a=document.getElementById("idea-form-container");e.showIdeaForm?(this.ideaForm||(this.ideaForm=new ie(i=>this.saveIdea(i),()=>this.hideIdeaForm(),e.editingIdea),a.innerHTML="",a.appendChild(this.ideaForm.render())),a.classList.remove("hidden")):(a.classList.add("hidden"),this.ideaForm&&(this.ideaForm.destroy(),this.ideaForm=null))}renderIdeasList(e,t){if(!e||e.length===0){t.innerHTML=`
        <div style="text-align: center; padding: 3rem; color: #6c757d;">
          <h3>No ideas yet</h3>
          <p>Start documenting your app concepts here.</p>
        </div>
      `;return}t.innerHTML=e.map(a=>this.renderIdeaItem(a)).join(""),t.querySelectorAll(".idea-item").forEach(a=>{a.addEventListener("click",()=>{const i=a.dataset.ideaId,s=l.getIdeaById(i);s&&this.editIdea(s)})})}renderIdeaItem(e){const t={Low:"#28a745",Medium:"#ffc107",High:"#dc3545"}[e.riskRating]||"#6c757d";return`
      <div class="idea-item" data-idea-id="${e.id}">
        <h4>${this.escapeHtml(e.conceptName)}</h4>
        <p>${this.escapeHtml(e.problemSolved.substring(0,100))}${e.problemSolved.length>100?"...":""}</p>
        <div class="idea-meta">
          <span>👥 ${this.escapeHtml(e.targetAudience)}</span>
          <span>🛠️ ${this.escapeHtml(e.techStack)}</span>
          <span style="color: ${t}">⚠️ ${e.riskRating} Risk</span>
          <span>📅 ${f(e.dateCreated)}</span>
        </div>
        <div style="margin-top: 1rem;">
          <button class="btn btn-primary" style="margin-right: 0.5rem;" onclick="event.stopPropagation(); app.activateIdea('${e.id}')">
            Activate & Create Repo
          </button>
          <button class="btn btn-secondary" onclick="event.stopPropagation(); app.editIdea('${e.id}')">
            Edit
          </button>
        </div>
      </div>
    `}showAppDetail(e){l.setCurrentApp(e),l.setActiveTab("overview"),this.showView("detail")}async saveDeveloperNotes(e,t){try{const a=l.getAppById(e);if(a){const i={...a,notes:t};await u.saveApp(i),l.updateApp(i)}}catch(a){console.error("Failed to save notes:",a),l.setError("Failed to save notes")}}showIdeaForm(e=null){l.setShowIdeaForm(!0,e)}hideIdeaForm(){l.setShowIdeaForm(!1)}editIdea(e){const t=l.getIdeaById(e);t&&this.showIdeaForm(t)}async saveIdea(e){try{await u.saveIdea(e),l.getIdeaById(e.id)?l.updateIdea(e):l.addIdea(e),this.hideIdeaForm()}catch(t){console.error("Failed to save idea:",t),l.setError("Failed to save idea")}}async activateIdea(e){const t=prompt("Enter GitHub repository URL for this app:");if(!t||!$(t)){alert("Please enter a valid GitHub repository URL");return}try{const a=await u.activateIdea(e,t);l.removeIdea(e),l.addApp(a),this.fetchGitHubDataForApps([a]),alert(`Idea activated successfully! App "${a.id}" added to portfolio.`)}catch(a){console.error("Failed to activate idea:",a),l.setError("Failed to activate idea")}}async refreshPortfolio(){try{l.setLoading(!0,"portfolioLoading");const e=await u.getPortfolio();l.setPortfolio(e),this.fetchGitHubDataForApps(e),l.setLoading(!1,"portfolioLoading")}catch(e){console.error("Failed to refresh portfolio:",e),l.setError("Failed to refresh portfolio","portfolioError"),l.setLoading(!1,"portfolioLoading")}}showLoading(e="Loading..."){const t=document.getElementById("loading-overlay"),a=t.querySelector("p");a&&(a.textContent=e),t.classList.remove("hidden")}hideLoading(){document.getElementById("loading-overlay").classList.add("hidden")}showError(e){const t=document.getElementById("error-toast"),a=document.getElementById("error-message");a&&(a.textContent=e),t.classList.remove("hidden"),setTimeout(()=>{this.hideError()},5e3)}hideError(){document.getElementById("error-toast").classList.add("hidden")}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}}const S=new re;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{S.init()}):S.init();window.app=S;
