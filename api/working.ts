// import type { VercelRequest, VercelResponse } from '@vercel/node';
// import TelegramBot from 'node-telegram-bot-api';
// import * as dotenv from 'dotenv';

// dotenv.config();
// const token = process.env.BOT_TOKEN || '8305223033:AAEGcYngeLYA9IUA6xIP43CUJfknN8zteKY';

// // ERPNext configuration
// const ERPNEXT_URL = process.env.ERPNEXT_URL;
// const ERPNEXT_API_KEY = process.env.ERPNEXT_API_KEY;
// const ERPNEXT_API_SECRET = process.env.ERPNEXT_API_SECRET;

// // User sessions to track conversation state
// const userSessions = new Map();

// // ==================== CORS HANDLER ====================
// const allowCors = fn => async (req, res) => {
//   console.log('[allowCors] Incoming request:', req.method, req.url);
  
//   res.setHeader('Access-Control-Allow-Credentials', true);
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
//   res.setHeader(
//     'Access-Control-Allow-Headers',
//     'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
//   );
  
//   if (req.method === 'OPTIONS') {
//     console.log('[allowCors] Handling OPTIONS preflight request');
//     res.status(200).end();
//     return;
//   }
  
//   console.log('[allowCors] Proceeding to main handler');
//   return await fn(req, res);
// };

// // ==================== SESSION TYPE ====================
// type SimpleSession = {
//   state: 'awaiting_item_selection' | 'awaiting_quantity' | 'awaiting_work_item' | 'awaiting_location' | 'awaiting_qty_of_work' | 'awaiting_warehouse_selection' | 'awaiting_item_action' | 'submitting' | 'searching_items';
//   requestData: {
//     items: Array<{
//       item_code: string;
//       qty: number;
//       uom?: string;
//       work_item?: string;
//       location?: string;
//       qty_of_work?: string;
//     }>;
//     warehouse?: string;
//     purpose?: 'Material Issue' | 'Material Transfer' | 'Purchase';
//     requested_by?: string;
//     userid?: string;
//   };
//   currentItem?: {
//     item_code?: string;
//     qty?: number;
//     uom?: string;
//     work_item?: string;
//     location?: string;
//     qty_of_work?: string;
//     item_name?: string;
//   };
//   lastError?: string;
//   availableWarehouses?: Array<{ displayName: string; actualName: string }>;
//   searchTerm?: string;
//   availableItems?: Array<{ displayName: string; item_code: string; item_name: string; stock_uom?: string }>;
//   currentPage?: number;
//   userInfo?: {
//     username?: string;
//     userid?: string;
//     full_name?: string;
//   };
// };

// // ==================== ERPNext API FUNCTIONS ====================

// /**
//  * Search items from ERPNext with UOM information
//  */
// const searchItems = async (searchTerm = '') => {
//   console.log('[searchItems] START - Searching items with term:', searchTerm);
  
//   try {
//     const url = `${ERPNEXT_URL}/api/resource/Item?fields=["name","item_name","item_code","disabled","stock_uom"]&limit_page_length=200`;
    
//     console.log('[searchItems] Making request to URL:', url);
    
//     const response = await fetch(url, {
//       method: 'GET',
//       headers: {
//         'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     console.log('[searchItems] Received response status:', response.status);
    
//     if (!response.ok) {
//       console.error('[searchItems] API response not OK:', response.status);
//       throw new Error(`ERPNext API error: ${response.status}`);
//     }

//     const data = await response.json();
//     console.log('[searchItems] Raw API response data received');
    
//     if (!data.data) {
//       console.log('[searchItems] No data field in response');
//       return [];
//     }

//     console.log(`[searchItems] Total items in response: ${data.data.length}`);
    
//     // Filter out disabled items
//     const enabledItems = data.data.filter(item => item.disabled !== 1);
//     console.log(`[searchItems] Enabled items after filtering: ${enabledItems.length}`);
    
//     // If search term provided, filter items
//     let filteredItems = enabledItems;
//     if (searchTerm && searchTerm.trim() !== '') {
//       const cleanSearchTerm = searchTerm.toLowerCase().trim();
      
//       filteredItems = enabledItems.filter(item => {
//         const itemName = (item.item_name || '').toLowerCase();
//         const itemCode = (item.item_code || '').toLowerCase();
        
//         return itemName.includes(cleanSearchTerm) ||
//                itemCode.includes(cleanSearchTerm) ||
//                cleanSearchTerm.includes(itemCode) ||
//                cleanSearchTerm.includes(itemName);
//       });
//     }

//     console.log(`[searchItems] Filtered items: ${filteredItems.length}`);
    
//     // Sort by item name for better UX
//     const sortedItems = filteredItems.sort((a, b) => {
//       const nameA = (a.item_name || '').toLowerCase();
//       const nameB = (b.item_name || '').toLowerCase();
//       return nameA.localeCompare(nameB);
//     });
    
//     console.log('[searchItems] END - Successfully completed search');
//     return sortedItems;
    
//   } catch (error) {
//     console.error('[searchItems] ERROR - Error searching items:', error.message);
//     throw error;
//   }
// };

// /**
//  * Search warehouses from ERPNext
//  */
// const searchWarehouses = async (searchTerm = '') => {
//   console.log('[searchWarehouses] START - Getting warehouses');

//   try {
//     const url = `${ERPNEXT_URL}/api/resource/Warehouse?fields=["name","warehouse_name"]&limit_page_length=100`;
    
//     console.log('[searchWarehouses] Making request to URL:', url);
    
//     const response = await fetch(url, {
//       method: 'GET',
//       headers: {
//         'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     console.log('[searchWarehouses] Received response status:', response.status);

//     if (!response.ok) {
//       console.error('[searchWarehouses] API response not OK');
//       throw new Error(`ERPNext API error: ${response.status}`);
//     }

//     const data = await response.json();
//     console.log('[searchWarehouses] Raw API response data received');

//     if (!data.data) {
//       console.log('[searchWarehouses] No data field in response');
//       return [];
//     }

//     console.log(`[searchWarehouses] Total warehouses fetched: ${data.data.length}`);
    
//     // Sort warehouses by name for better UX
//     const sortedWarehouses = data.data.sort((a, b) => {
//       const nameA = (a.warehouse_name || a.name || '').toLowerCase();
//       const nameB = (b.warehouse_name || b.name || '').toLowerCase();
//       return nameA.localeCompare(nameB);
//     });
    
//     console.log('[searchWarehouses] END - Successfully completed search');
//     return sortedWarehouses;

//   } catch (error) {
//     console.error('[searchWarehouses] ERROR - Error searching warehouses:', error.message);
//     throw error;
//   }
// };

// /**
//  * Create Material Request in ERPNext with user information
//  */
// const createMaterialRequest = async (materialRequestData, userInfo) => {
//   console.log('[createMaterialRequest] START - Creating material request with data:', materialRequestData);

//   try {
//     console.log('[createMaterialRequest] Step 1: Fetching company information');
    
//     const companiesResponse = await fetch(`${ERPNEXT_URL}/api/resource/Company?fields=["name"]&limit_page_length=1`, {
//       method: 'GET',
//       headers: {
//         'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     let companyName = 'Tibeb Technology Solutions';
//     if (companiesResponse.ok) {
//       const companiesData = await companiesResponse.json();
//       if (companiesData.data && companiesData.data.length > 0) {
//         companyName = companiesData.data[0].name;
//       }
//     }
//     console.log('[createMaterialRequest] Using company:', companyName);

//     // Determine material request type based on purpose
//     let materialRequestType = 'Purchase';
//     if (materialRequestData.purpose === 'Material Issue') {
//       materialRequestType = 'Material Issue';
//     } else if (materialRequestData.purpose === 'Material Transfer') {
//       materialRequestType = 'Material Transfer';
//     }

//     console.log('[createMaterialRequest] Validating items before submission');
//     for (const item of materialRequestData.items) {
//       try {
//         const itemCheck = await fetch(`${ERPNEXT_URL}/api/resource/Item/${item.item_code}?fields=["name","disabled"]`, {
//           method: 'GET',
//           headers: {
//             'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
//             'Content-Type': 'application/json'
//           }
//         });
        
//         if (itemCheck.ok) {
//           const itemData = await itemCheck.json();
//           if (itemData.data.disabled === 1) {
//             throw new Error(`Item ${item.item_code} is disabled`);
//           }
//         }
//       } catch (itemError) {
//         console.error(`[createMaterialRequest] Item validation failed for ${item.item_code}:`, itemError.message);
//         throw itemError;
//       }
//     }

//     const actualWarehouseName = materialRequestData.warehouse;

//     const payload = {
//       doctype: "Material Request",
//       company: companyName,
//       transaction_date: new Date().toISOString().split('T')[0],
//       material_request_type: materialRequestType,
//       schedule_date: materialRequestData.required_by || new Date().toISOString().split('T')[0],
//       set_warehouse: actualWarehouseName,
//       // Custom fields with user information
//       my_warehouse: actualWarehouseName,
//       requested_by: userInfo?.full_name || userInfo?.username || 'Telegram User',
//       userid: userInfo?.userid || 'telegram_user',
//       work_item: "General Purchase",
//       location: "Main Site",
//       qty_of_work: materialRequestData.items.reduce((sum, item) => sum + item.qty, 0),
//       items: materialRequestData.items.map(item => ({
//         item_code: item.item_code,
//         qty: item.qty,
//         warehouse: actualWarehouseName,
//         schedule_date: materialRequestData.required_by || new Date().toISOString().split('T')[0],
//         uom: item.uom || "Nos",
//         // Custom fields for each item
//         work_item: item.work_item || item.item_code,
//         location: item.location || "Main Site",
//         qty_of_work: item.qty_of_work || item.qty.toString(),
//         specification: "Standard Specification"
//       }))
//     };

//     console.log('[createMaterialRequest] Step 2: Sending material request payload:', JSON.stringify(payload, null, 2));

//     const response = await fetch(`${ERPNEXT_URL}/api/resource/Material Request`, {
//       method: 'POST',
//       headers: {
//         'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
//         'Content-Type': 'application/json',
//         'Accept': 'application/json'
//       },
//       body: JSON.stringify(payload)
//     });

//     console.log('[createMaterialRequest] Material request response status:', response.status);

//     if (!response.ok) {
//       let errorText = await response.text();
//       console.error('[createMaterialRequest] API Error Response:', errorText);
      
//       let userFriendlyError = 'Failed to create material request. Please contact administrator.';
      
//       // Try to extract meaningful error from response
//       try {
//         if (errorText.includes('MandatoryError')) {
//           userFriendlyError = 'Missing required fields. Please contact administrator.';
//         } else if (errorText.includes('BrokenPipeError')) {
//           userFriendlyError = 'System temporarily unavailable. Please try again in a moment.';
//         }
//       } catch (parseError) {
//         console.error('[createMaterialRequest] Could not parse error response:', parseError);
//       }
      
//       console.log('[createMaterialRequest] END - Failed with API error');
//       throw new Error(userFriendlyError);
//     }

//     const result = await response.json();
//     console.log('[createMaterialRequest] Material request created successfully:', result);
//     console.log('[createMaterialRequest] END - Successfully created material request');
//     return result;

//   } catch (error) {
//     console.error('[createMaterialRequest] ERROR - Failed to create material request:', error);
//     throw error;
//   }
// };

// // ==================== WELCOME & NAVIGATION FLOW ====================

// /**
//  * FLOW 1: Show main purpose options
//  */
// const showPurposeOptions = async (chatId, bot, userInfo = {}) => {
//   console.log('[showPurposeOptions] Showing purpose options to chat:', chatId);
  
//   const message = `🏗️ *Tibeb Design & Build* 🏗️
// ╔═══════════════════════╗
//    *Digital Transaction Bot*
// ╚═══════════════════════╝

// 🌟 *Your digital assistant for seamless transactions!*

// 📋 *Available Services:*
// • Material request management
// • Real-time status tracking  
// • Quick digital approvals
// • Instant notifications

// 🎯 *Please choose your action:*`;
  
//   const options = {
//     parse_mode: 'Markdown',
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: '🛒 CREATE MATERIAL REQUEST', callback_data: 'material_request' }],
//         [{ text: '📊 VIEW REQUEST STATUS', callback_data: 'view_status' }],
//         [{ text: '❓ HELP & SUPPORT', callback_data: 'help_support' }]
//       ]
//     }
//   };
  
//   return bot.sendMessage(chatId, message, options);
// };

// /**
//  * FLOW 2: Show material request type options
//  */
// const showMaterialRequestOptions = async (chatId, bot) => {
//   console.log('[showMaterialRequestOptions] Showing material request options to chat:', chatId);
  
//   const message = `🎯 *Please choose request type:*`;
  
//   const options = {
//     parse_mode: 'Markdown',
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: '📤 MATERIAL ISSUE', callback_data: 'material_issue' }],
//         [{ text: '🔄 MATERIAL TRANSFER', callback_data: 'material_transfer' }],
//         [{ text: '🛒 MATERIAL PURCHASE', callback_data: 'material_purchase' }],
//         [{ text: '⬅️ BACK', callback_data: 'back_to_main' }]
//       ]
//     }
//   };
  
//   return bot.sendMessage(chatId, message, options);
// };

// /**
//  * FLOW 3: Start Material Issue Process
//  */
// const startMaterialIssue = async (bot, chatId, userInfo) => {
//   console.log('[startMaterialIssue] Starting material issue process for chat:', chatId);
  
//   userSessions.set(chatId, {
//     state: 'searching_items',
//     requestData: { 
//       items: [],
//       purpose: 'Material Issue',
//       requested_by: userInfo?.full_name || userInfo?.username,
//       userid: userInfo?.userid
//     },
//     currentItem: {},
//     searchTerm: '',
//     availableItems: [],
//     currentPage: 0,
//     userInfo: userInfo
//   });
  
//   const message = `📤 *Material Issue Process Started*\n\n🔍 How would you like to find items?`;
  
//   const options = {
//     parse_mode: 'Markdown',
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: '🔍 SEARCH ITEMS', callback_data: 'search_items' }],
//         [{ text: '📋 SHOW ALL ITEMS', callback_data: 'show_all_items' }],
//         [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//       ]
//     }
//   };
  
//   return bot.sendMessage(chatId, message, options);
// };

// /**
//  * FLOW 4: Show search input prompt
//  */
// const showSearchPrompt = async (bot, chatId) => {
//   console.log('[showSearchPrompt] Showing search prompt for chat:', chatId);
  
//   const session = userSessions.get(chatId);
//   if (!session) {
//     return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
//   }
  
//   session.state = 'awaiting_item_selection';
//   userSessions.set(chatId, session);
  
//   const message = `🔍 *Enter Search Term*\n\nPlease type the item name or code you're looking for:`;
  
//   const options = {
//     parse_mode: 'Markdown',
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: '⬅️ BACK', callback_data: 'back_to_item_options' }],
//         [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//       ]
//     }
//   };
  
//   return bot.sendMessage(chatId, message, options);
// };

// /**
//  * FLOW 5: Show item selection list with pagination
//  */
// const showItemSelectionList = async (bot, chatId, searchTerm = '', page = 0) => {
//   console.log('[showItemSelectionList] Showing items for chat:', chatId, 'Search term:', searchTerm, 'Page:', page);
  
//   try {
//     const items = await searchItems(searchTerm);
    
//     if (items.length === 0) {
//       const message = searchTerm ? 
//         `❌ No items found matching "${searchTerm}".` : 
//         `❌ No items found in the system.`;
      
//       const options = {
//         parse_mode: 'Markdown',
//         reply_markup: {
//           inline_keyboard: [
//             [{ text: '🔍 SEARCH AGAIN', callback_data: 'search_items' }],
//             [{ text: '📋 SHOW ALL ITEMS', callback_data: 'show_all_items' }],
//             [{ text: '⬅️ BACK', callback_data: 'back_to_item_options' }],
//             [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//           ]
//         }
//       };
      
//       return bot.sendMessage(chatId, message, options);
//     }
    
//     // Store items in session
//     const session = userSessions.get(chatId);
//     if (session) {
//       session.availableItems = items.map(item => ({
//         displayName: `${item.item_name || item.name} (${item.item_code || item.name})`,
//         item_code: item.item_code || item.name,
//         item_name: item.item_name || item.name,
//         stock_uom: item.stock_uom || 'Nos'
//       }));
//       session.currentPage = page;
//       userSessions.set(chatId, session);
//     }
    
//     // Pagination - 8 items per page
//     const itemsPerPage = 8;
//     const totalPages = Math.ceil(items.length / itemsPerPage);
//     const startIndex = page * itemsPerPage;
//     const endIndex = startIndex + itemsPerPage;
//     const itemsToShow = items.slice(startIndex, endIndex);
    
//     // Create inline keyboard with items
//     const itemButtons = itemsToShow.map(item => [
//       { 
//         text: `📦 ${item.item_name || item.name}`, 
//         callback_data: `select_item:${item.item_code || item.name}` 
//       }
//     ]);
    
//     // Add pagination buttons if needed
//     const paginationButtons = [];
//     if (totalPages > 1) {
//       if (page > 0) {
//         paginationButtons.push({ text: '⬅️ Previous', callback_data: `item_page:${page - 1}:${searchTerm}` });
//       }
//       if (page < totalPages - 1) {
//         paginationButtons.push({ text: 'Next ➡️', callback_data: `item_page:${page + 1}:${searchTerm}` });
//       }
//     }
    
//     const navigationButtons = [];
//     if (searchTerm) {
//       navigationButtons.push({ text: '🔍 NEW SEARCH', callback_data: 'search_items' });
//     }
//     navigationButtons.push({ text: '📋 SHOW ALL', callback_data: 'show_all_items' });
//     navigationButtons.push({ text: '⬅️ BACK', callback_data: 'back_to_item_options' });
//     navigationButtons.push({ text: '❌ CANCEL', callback_data: 'cancel_process' });
    
//     const inline_keyboard = [
//       ...itemButtons,
//       ...(paginationButtons.length > 0 ? [paginationButtons] : []),
//       navigationButtons
//     ];
    
//     let message = `📦 *Select an Item*`;
//     if (searchTerm) {
//       message += `\n🔍 Search results for "${searchTerm}"`;
//     } else {
//       message += `\n📋 All available items`;
//     }
//     message += `\n📊 Found ${items.length} items`;
//     if (totalPages > 1) {
//       message += `\n📄 Page ${page + 1} of ${totalPages}`;
//     }
    
//     const options = {
//       parse_mode: 'Markdown',
//       reply_markup: { inline_keyboard }
//     };
    
//     return bot.sendMessage(chatId, message, options);
//   } catch (error) {
//     console.error('[showItemSelectionList] Error:', error);
    
//     const options = {
//       parse_mode: 'Markdown',
//       reply_markup: {
//         inline_keyboard: [
//           [{ text: '🔄 TRY AGAIN', callback_data: 'show_all_items' }],
//           [{ text: '⬅️ BACK', callback_data: 'back_to_item_options' }],
//           [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//         ]
//       }
//     };
    
//     return bot.sendMessage(chatId, '❌ Error loading items. Please try again.', options);
//   }
// };

// /**
//  * FLOW 6: Show quantity input with UOM
//  */
// const showQuantityInput = async (bot, chatId, itemCode, itemName, uom = 'Nos') => {
//   console.log('[showQuantityInput] Showing quantity input for item:', itemCode, 'UOM:', uom);
  
//   const session = userSessions.get(chatId);
//   if (!session) {
//     return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
//   }
  
//   session.currentItem = { 
//     item_code: itemCode, 
//     item_name: itemName,
//     uom: uom
//   };
//   session.state = 'awaiting_quantity';
//   userSessions.set(chatId, session);
  
//   const message = `✅ *Selected:* ${itemName}\n\n📦 *Enter Quantity*\n\nPlease type the quantity you need (in ${uom}):`;
  
//   const options = {
//     parse_mode: 'Markdown',
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: '⬅️ BACK TO ITEMS', callback_data: 'back_to_items' }],
//         [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//       ]
//     }
//   };
  
//   return bot.sendMessage(chatId, message, options);
// };

// /**
//  * FLOW 7: Show work item input
//  */
// const showWorkItemInput = async (bot, chatId) => {
//   console.log('[showWorkItemInput] Showing work item input for chat:', chatId);
  
//   const session = userSessions.get(chatId);
//   if (!session) {
//     return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
//   }
  
//   session.state = 'awaiting_work_item';
//   userSessions.set(chatId, session);
  
//   const message = `🔧 *Enter Work Item*\n\nPlease specify the work item for ${session.currentItem?.item_name}:`;
  
//   const options = {
//     parse_mode: 'Markdown',
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: '⬅️ BACK', callback_data: 'back_to_quantity' }],
//         [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//       ]
//     }
//   };
  
//   return bot.sendMessage(chatId, message, options);
// };

// /**
//  * FLOW 8: Show location input
//  */
// const showLocationInput = async (bot, chatId) => {
//   console.log('[showLocationInput] Showing location input for chat:', chatId);
  
//   const session = userSessions.get(chatId);
//   if (!session) {
//     return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
//   }
  
//   session.state = 'awaiting_location';
//   userSessions.set(chatId, session);
  
//   const message = `📍 *Enter Location*\n\nPlease specify the location for ${session.currentItem?.item_name}:`;
  
//   const options = {
//     parse_mode: 'Markdown',
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: '⬅️ BACK', callback_data: 'back_to_work_item' }],
//         [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//       ]
//     }
//   };
  
//   return bot.sendMessage(chatId, message, options);
// };

// /**
//  * FLOW 9: Show quantity of work input
//  */
// const showQtyOfWorkInput = async (bot, chatId) => {
//   console.log('[showQtyOfWorkInput] Showing quantity of work input for chat:', chatId);
  
//   const session = userSessions.get(chatId);
//   if (!session) {
//     return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
//   }
  
//   session.state = 'awaiting_qty_of_work';
//   userSessions.set(chatId, session);
  
//   const message = `📊 *Enter Quantity of Work*\n\nPlease specify the quantity of work for ${session.currentItem?.item_name}:`;
  
//   const options = {
//     parse_mode: 'Markdown',
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: '⬅️ BACK', callback_data: 'back_to_location' }],
//         [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//       ]
//     }
//   };
  
//   return bot.sendMessage(chatId, message, options);
// };

// /**
//  * FLOW 10: Show item action options (add another or finish)
//  */
// const showItemActionOptions = async (bot, chatId) => {
//   console.log('[showItemActionOptions] Showing item action options for chat:', chatId);
  
//   const session = userSessions.get(chatId);
//   if (!session) {
//     return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
//   }
  
//   session.state = 'awaiting_item_action';
//   userSessions.set(chatId, session);
  
//   const currentItems = session.requestData.items.map((item, index) => 
//     `${index + 1}. ${item.item_code} - Qty: ${item.qty} ${item.uom || 'Nos'}`
//   ).join('\n');
  
//   const message = `✅ *Item Added Successfully!*\n\n*Current Items:*\n${currentItems}\n\nWhat would you like to do next?`;
  
//   const options = {
//     parse_mode: 'Markdown',
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: '➕ ADD ANOTHER ITEM', callback_data: 'add_another_item' }],
//         [{ text: '✅ FINISH & SELECT WAREHOUSE', callback_data: 'finish_items' }],
//         [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//       ]
//     }
//   };
  
//   return bot.sendMessage(chatId, message, options);
// };

// /**
//  * FLOW 11: Show warehouse selection
//  */
// const showWarehouseSelection = async (bot, chatId) => {
//   console.log('[showWarehouseSelection] Showing warehouses for chat:', chatId);
  
//   try {
//     const warehouses = await searchWarehouses('');
    
//     if (warehouses.length === 0) {
//       const options = {
//         parse_mode: 'Markdown',
//         reply_markup: {
//           inline_keyboard: [
//             [{ text: '🔄 TRY AGAIN', callback_data: 'back_to_warehouses' }],
//             [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//           ]
//         }
//       };
      
//       return bot.sendMessage(chatId, '❌ No warehouses found. Please try again later.', options);
//     }
    
//     const session = userSessions.get(chatId);
//     if (session) {
//       session.availableWarehouses = warehouses.map(warehouse => ({
//         displayName: warehouse.warehouse_name || warehouse.name,
//         actualName: warehouse.name
//       }));
//       userSessions.set(chatId, session);
//     }
    
//     // Create warehouse buttons (2 per row)
//     const warehouseButtons = [];
//     for (let i = 0; i < warehouses.length; i += 2) {
//       const row = [];
//       if (warehouses[i]) {
//         row.push({ 
//           text: `🏭 ${warehouses[i].warehouse_name || warehouses[i].name}`, 
//           callback_data: `select_warehouse:${warehouses[i].name}` 
//         });
//       }
//       if (warehouses[i + 1]) {
//         row.push({ 
//           text: `🏭 ${warehouses[i + 1].warehouse_name || warehouses[i + 1].name}`, 
//           callback_data: `select_warehouse:${warehouses[i + 1].name}` 
//         });
//       }
//       warehouseButtons.push(row);
//     }
    
//     const inline_keyboard = [
//       ...warehouseButtons,
//       [{ text: '⬅️ BACK TO ITEMS', callback_data: 'back_to_item_action' }],
//       [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//     ];
    
//     const message = `🏭 *Select Warehouse*\n\nChoose a warehouse from the list below:`;
    
//     const options = {
//       parse_mode: 'Markdown',
//       reply_markup: { inline_keyboard }
//     };
    
//     return bot.sendMessage(chatId, message, options);
//   } catch (error) {
//     console.error('[showWarehouseSelection] Error:', error);
    
//     const options = {
//       parse_mode: 'Markdown',
//       reply_markup: {
//         inline_keyboard: [
//           [{ text: '🔄 TRY AGAIN', callback_data: 'back_to_warehouses' }],
//           [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
//         ]
//       }
//     };
    
//     return bot.sendMessage(chatId, '❌ Error loading warehouses. Please try again.', options);
//   }
// };

// /**
//  * FLOW 12: Handle warehouse selection and create Material Issue
//  */
// const handleWarehouseSelection = async (bot, chatId, warehouseName) => {
//   console.log('[handleWarehouseSelection] Handling warehouse selection:', warehouseName);
  
//   const session = userSessions.get(chatId);
//   if (!session) {
//     return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
//   }
  
//   const validWarehouse = session.availableWarehouses?.find(
//     wh => wh.actualName === warehouseName
//   );
  
//   if (!validWarehouse) {
//     return showWarehouseSelection(bot, chatId);
//   }
  
//   session.requestData.warehouse = validWarehouse.actualName;
  
//   // Show summary and create Material Issue
//   const summary = `📋 *Material Issue Summary*\n\n` +
//     `*Items:*\n${session.requestData.items.map((item, idx) => 
//       `${idx + 1}. ${item.item_code} - Qty: ${item.qty} ${item.uom || 'Nos'}\n   Work Item: ${item.work_item || 'N/A'}\n   Location: ${item.location || 'N/A'}\n   Qty of Work: ${item.qty_of_work || 'N/A'}`
//     ).join('\n\n')}\n\n` +
//     `*Warehouse:* ${validWarehouse.displayName}\n` +
//     `*Purpose:* ${session.requestData.purpose}\n` +
//     `*Requested By:* ${session.requestData.requested_by || 'N/A'}\n\n` +
//     `⏳ Creating material issue...`;
  
//   await bot.sendMessage(chatId, summary, { parse_mode: 'Markdown' });
  
//   try {
//     // Create Material Issue in ERPNext
//     const result = await createMaterialRequest(session.requestData, session.userInfo);
    
//     const successMessage = `🎉 *Material Issue Created Successfully!*\n\n` +
//       `*Items Issued:*\n${session.requestData.items.map((item, idx) => 
//         `${idx + 1}. ${item.item_code} - Qty: ${item.qty} ${item.uom || 'Nos'}`
//       ).join('\n')}\n\n` +
//       `*From Warehouse:* ${validWarehouse.displayName}\n` +
//       `*Reference:* ${result.data.name}\n` +
//       `✅ *Status:* Submitted\n\n` +
//       `Your material issue has been processed successfully!`;
    
//     userSessions.delete(chatId);
    
//     const options = {
//       parse_mode: 'Markdown',
//       reply_markup: {
//         inline_keyboard: [
//           [{ text: '🛒 CREATE NEW REQUEST', callback_data: 'material_request' }],
//           [{ text: '📊 VIEW STATUS', callback_data: 'view_status' }],
//           [{ text: '🏠 MAIN MENU', callback_data: 'back_to_main' }]
//         ]
//       }
//     };
    
//     return bot.sendMessage(chatId, successMessage, options);
    
//   } catch (error) {
//     console.error('[handleWarehouseSelection] Error:', error);
    
//     userSessions.delete(chatId);
    
//     const options = {
//       parse_mode: 'Markdown',
//       reply_markup: {
//         inline_keyboard: [
//           [{ text: '🔄 TRY AGAIN', callback_data: 'material_issue' }],
//           [{ text: '🏠 MAIN MENU', callback_data: 'back_to_main' }]
//         ]
//       }
//     };
    
//     return bot.sendMessage(chatId, 
//       `❌ Failed to create material issue: ${error.message}\n\nPlease try again.`, 
//       options
//     );
//   }
// };

// // ==================== MAIN HANDLER ====================
// const handler = async (req: VercelRequest, res: VercelResponse) => {
//   console.log('[handler] START - Method:', req.method);

//   if (req.method === 'GET') {
//     return res.status(200).json({
//       status: 'Bot is running',
//       message: 'Tibeb Design & Build Bot is active'
//     });
//   }

//   const { body } = req;
//   const bot = new TelegramBot(token);

//   try {
//     if (body.message) {
//       const { chat, text, from } = body.message;
//       const chatId = chat.id;
//       const session = userSessions.get(chatId);

//       // Extract user information
//       const userInfo = {
//         username: from?.username,
//         userid: from?.id?.toString(),
//         full_name: `${from?.first_name || ''} ${from?.last_name || ''}`.trim() || from?.username
//       };

//       console.log('[handler] Processing message from:', userInfo.full_name, 'Chat ID:', chatId, 'Text:', text);

//       // Handle /start command
//       if (text === '/start') {
//         await showPurposeOptions(chatId, bot, userInfo);
//         return res.status(200).json({ status: 'ok' });
//       }

//       // Handle text input for various states
//       if (session) {
//         switch (session.state) {
//           case 'awaiting_item_selection':
//             // User entered search term
//             await showItemSelectionList(bot, chatId, text);
//             break;
            
//           case 'awaiting_quantity':
//             // User entered quantity
//             const qty = parseFloat(text);
//             if (isNaN(qty) || qty <= 0) {
//               await bot.sendMessage(chatId, '❌ Please enter a valid quantity (number greater than 0):');
//             } else {
//               session.currentItem.qty = qty;
//               await showWorkItemInput(bot, chatId);
//             }
//             break;
            
//           case 'awaiting_work_item':
//             // User entered work item
//             session.currentItem.work_item = text;
//             await showLocationInput(bot, chatId);
//             break;
            
//           case 'awaiting_location':
//             // User entered location
//             session.currentItem.location = text;
//             await showQtyOfWorkInput(bot, chatId);
//             break;
            
//           case 'awaiting_qty_of_work':
//             // User entered quantity of work
//             session.currentItem.qty_of_work = text;
            
//             // Add completed item to request data
//             session.requestData.items.push({
//               item_code: session.currentItem.item_code!,
//               qty: session.currentItem.qty!,
//               uom: session.currentItem.uom,
//               work_item: session.currentItem.work_item,
//               location: session.currentItem.location,
//               qty_of_work: session.currentItem.qty_of_work
//             });
            
//             await showItemActionOptions(bot, chatId);
//             break;
            
//           default:
//             await showPurposeOptions(chatId, bot, userInfo);
//         }
//         return res.status(200).json({ status: 'ok' });
//       }

//       // No active session
//       await showPurposeOptions(chatId, bot, userInfo);

//     } else if (body.callback_query) {
//       // Handle inline button callbacks
//       const { data, message, from } = body.callback_query;
//       const chatId = message.chat.id;

//       // Extract user information from callback
//       const userInfo = {
//         username: from?.username,
//         userid: from?.id?.toString(),
//         full_name: `${from?.first_name || ''} ${from?.last_name || ''}`.trim() || from?.username
//       };

//       console.log('[handler] Processing callback:', data);

//       // Handle complex callback data with parameters
//       if (data.startsWith('select_item:')) {
//         const itemCode = data.split(':')[1];
//         const session = userSessions.get(chatId);
//         const item = session?.availableItems?.find(i => i.item_code === itemCode);
//         if (item) {
//           await showQuantityInput(bot, chatId, itemCode, item.displayName, item.stock_uom);
//         }
//       }
//       else if (data.startsWith('item_page:')) {
//         const [_, page, searchTerm] = data.split(':');
//         await showItemSelectionList(bot, chatId, searchTerm, parseInt(page));
//       }
//       else if (data.startsWith('select_warehouse:')) {
//         const warehouseName = data.split(':')[1];
//         await handleWarehouseSelection(bot, chatId, warehouseName);
//       }
//       else {
//         // Handle simple callbacks
//         switch (data) {
//           case 'material_request':
//             await showMaterialRequestOptions(chatId, bot);
//             break;
            
//           case 'material_issue':
//             await startMaterialIssue(bot, chatId, userInfo);
//             break;
            
//           case 'search_items':
//             await showSearchPrompt(bot, chatId);
//             break;
            
//           case 'show_all_items':
//             await showItemSelectionList(bot, chatId, '');
//             break;
            
//           case 'back_to_item_options':
//             await startMaterialIssue(bot, chatId, userInfo);
//             break;
            
//           case 'back_to_items':
//             await showItemSelectionList(bot, chatId, '');
//             break;
            
//           case 'back_to_quantity':
//             const sessionQty = userSessions.get(chatId);
//             if (sessionQty?.currentItem?.item_code) {
//               const item = sessionQty.availableItems?.find(i => i.item_code === sessionQty.currentItem.item_code);
//               if (item) {
//                 await showQuantityInput(bot, chatId, sessionQty.currentItem.item_code, item.displayName, item.stock_uom);
//               }
//             }
//             break;
            
//           case 'back_to_work_item':
//             await showWorkItemInput(bot, chatId);
//             break;
            
//           case 'back_to_location':
//             await showLocationInput(bot, chatId);
//             break;
            
//           case 'back_to_item_action':
//             await showItemActionOptions(bot, chatId);
//             break;
            
//           case 'back_to_warehouses':
//             await showWarehouseSelection(bot, chatId);
//             break;
            
//           case 'add_another_item':
//             await showItemSelectionList(bot, chatId, '');
//             break;
            
//           case 'finish_items':
//             await showWarehouseSelection(bot, chatId);
//             break;
            
//           case 'cancel_process':
//             userSessions.delete(chatId);
//             await bot.sendMessage(chatId, '❌ Request cancelled.');
//             await showPurposeOptions(chatId, bot, userInfo);
//             break;
            
//           case 'material_transfer':
//             await bot.sendMessage(chatId, '🔄 Material Transfer - This feature is coming soon!');
//             await showPurposeOptions(chatId, bot, userInfo);
//             break;
            
//           case 'material_purchase':
//             await bot.sendMessage(chatId, '🛒 Material Purchase - This feature is coming soon!');
//             await showPurposeOptions(chatId, bot, userInfo);
//             break;
            
//           case 'view_status':
//             await bot.sendMessage(chatId, '📊 View Request Status - This feature is coming soon!');
//             await showPurposeOptions(chatId, bot, userInfo);
//             break;
            
//           case 'help_support':
//             await bot.sendMessage(chatId, '❓ Help & Support - Contact administrator for assistance.');
//             await showPurposeOptions(chatId, bot, userInfo);
//             break;
            
//           case 'back_to_main':
//             userSessions.delete(chatId);
//             await showPurposeOptions(chatId, bot, userInfo);
//             break;
            
//           default:
//             await bot.sendMessage(chatId, '❌ Unknown option. Please try again.');
//             await showPurposeOptions(chatId, bot, userInfo);
//         }
//       }
//     }

//     return res.status(200).json({ status: 'ok' });

//   } catch (error) {
//     console.error('[handler] ERROR:', error);
//     return res.status(500).json({ error: 'Internal server error' });
//   }
// };



// export default allowCors(handler);



import { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import {
  userSessions,
  showPurposeOptions,
  showMaterialRequestOptions,
  startMaterialIssue,
  showSearchPrompt,
  showItemSelectionList,
  showQuantityInput,
  showWorkItemInput,
  showLocationInput,
  showQtyOfWorkInput,
  showItemActionOptions,
  showWarehouseSelection,
  handleWarehouseSelection,
  showUserSearchPrompt,
  showUserSelectionList,
  handleUserSelection,
  startMaterialPurchase,
  handleCheckBalance,
  showCheckerActionOptions,
  handleCheckerConfirm,
  handleCheckerCancel,
  showApproverSearchPrompt,
  showApproverSelectionList,
  handleApproverSelection,
  handleApproverApprove,
  handleApproverReject,
  handleRequestSubmission
} from './handlers';
import { findUserByTelegramId } from './erpnext';

dotenv.config();
const token = process.env.BOT_TOKEN || '8305223033:AAEGcYngeLYA9IUA6xIP43CUJfknN8zteKY';

// ==================== CORS HANDLER ====================
const allowCors = fn => async (req, res) => {
  console.log('[allowCors] Incoming request:', req.method, req.url);
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    console.log('[allowCors] Handling OPTIONS preflight request');
    res.status(200).end();
    return;
  }
  
  console.log('[allowCors] Proceeding to main handler');
  return await fn(req, res);
};

// ==================== MAIN HANDLER ====================
const handler = async (req: VercelRequest, res: VercelResponse) => {
  console.log('[handler] START - Method:', req.method);

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'Bot is running',
      message: 'Tibeb Design & Build Bot is active'
    });
  }

  const { body } = req;
  const bot = new TelegramBot(token, { polling: false });

  try {
    if (body.message) {
      const { chat, text, from } = body.message;
      const chatId = chat.id;
      const session = userSessions.get(chatId);

      // Find user in ERPNext to get their full name
      const erpUser = await findUserByTelegramId(from.id.toString());

      const userInfo = {
        username: from?.username,
        userid: from?.id?.toString(),
        full_name: erpUser?.full_name || `${from?.first_name || ''} ${from?.last_name || ''}`.trim() || from?.username
      };

      console.log('[handler] Processing message from:', userInfo.full_name, 'Chat ID:', chatId, 'Text:', text);

      if (text === '/start') {
        await showPurposeOptions(chatId, bot, userInfo);
        return res.status(200).json({ status: 'ok' });
      }

      if (session) {
        switch (session.state) {
          case 'awaiting_item_selection':
            await showItemSelectionList(bot, chatId, text);
            break;
          case 'awaiting_quantity':
            const qty = parseFloat(text);
            if (!isNaN(qty) && qty > 0) {
              session.currentItem.qty = qty;
              await showWorkItemInput(bot, chatId);
            } else {
              bot.sendMessage(chatId, 'Invalid quantity. Please enter a positive number.');
            }
            break;
          case 'awaiting_work_item':
            session.currentItem.work_item = text;
            await showLocationInput(bot, chatId);
            break;
          case 'awaiting_location':
            session.currentItem.location = text;
            await showQtyOfWorkInput(bot, chatId);
            break;
          case 'awaiting_qty_of_work':
            session.currentItem.qty_of_work = text;
            session.requestData.items.push(session.currentItem);
            session.currentItem = {};
            await showItemActionOptions(bot, chatId);
            break;
          case 'awaiting_user_search':
            await showUserSelectionList(bot, chatId, text);
            break;
          case 'awaiting_approver_search':
            // This state is handled by callbacks, but we need to acknowledge it.
            break;
        }
      }
    } else if (body.callback_query) {
      const { message, data, from } = body.callback_query;
      const chatId = message.chat.id;
      const session = userSessions.get(chatId);

      // Find user in ERPNext to get their full name
      const erpUser = await findUserByTelegramId(from.id.toString());

      const userInfo = {
        username: from?.username,
        userid: from?.id?.toString(),
        full_name: erpUser?.full_name || `${from?.first_name || ''} ${from?.last_name || ''}`.trim() || from?.username
      };

      console.log('[handler] Processing callback from:', userInfo.full_name, 'Chat ID:', chatId, 'Data:', data);

      if (data.startsWith('item_page:')) {
        const [, page, searchTerm] = data.split(':');
        await showItemSelectionList(bot, chatId, searchTerm, parseInt(page, 10));
      } else if (data.startsWith('select_item:')) {
        const itemCode = data.split(':')[1];
        const selectedItem = session?.availableItems?.find(item => item.item_code === itemCode);
        if (selectedItem) {
          await showQuantityInput(bot, chatId, itemCode, selectedItem.item_name, selectedItem.stock_uom);
        }
      } else if (data.startsWith('select_warehouse:')) {
        const warehouseName = data.split(':')[1];
        await handleWarehouseSelection(bot, chatId, warehouseName);
      } else if (data.startsWith('select_user:')) {
        const userName = data.split(':')[1];
        await handleUserSelection(bot, chatId, userName);
      } else if (data.startsWith('user_page:')) {
        const [, page, searchTerm] = data.split(':');
        await showUserSelectionList(bot, chatId, searchTerm, parseInt(page, 10));
      } else if (data.startsWith('check_balance:')) {
        const requestId = data.split(':')[1];
        await handleCheckBalance(bot, chatId, requestId);
      } else if (data.startsWith('checker_action:')) {
        const requestId = data.split(':')[1];
        await showCheckerActionOptions(bot, chatId, requestId);
      } else if (data.startsWith('checker_confirm:')) {
        const requestId = data.split(':')[1];
        await handleCheckerConfirm(bot, chatId, requestId);
      } else if (data.startsWith('checker_cancel:')) {
        const requestId = data.split(':')[1];
        await handleCheckerCancel(bot, chatId, requestId);
      } else if (data.startsWith('approver_approve:')) {
        const requestId = data.split(':')[1];
        await handleApproverApprove(bot, chatId, requestId);
      } else if (data.startsWith('approver_reject:')) {
        const requestId = data.split(':')[1];
        await handleApproverReject(bot, chatId, requestId);
      } else if (data.startsWith('select_approver:')) {
        const [, requestId, approverName] = data.split(':');
        await handleApproverSelection(bot, chatId, requestId, approverName);
      } else if (data.startsWith('approver_page:')) {
        const [, requestId, page, searchTerm] = data.split(':');
        await showApproverSelectionList(bot, chatId, requestId, searchTerm, parseInt(page, 10));
      } else if (data.startsWith('submit_request:')) {
        const requestId = data.split(':')[1];
        await handleRequestSubmission(bot, chatId, requestId);
      } else {
        switch (data) {
          case 'material_request':
            await showMaterialRequestOptions(chatId, bot);
            break;
          case 'material_issue':
            await startMaterialIssue(bot, chatId, userInfo);
            break;
          case 'material_purchase':
            await startMaterialPurchase(bot, chatId, userInfo);
            break;
          case 'search_items':
            await showSearchPrompt(bot, chatId);
            break;
          case 'show_all_items':
            await showItemSelectionList(bot, chatId, '');
            break;
          case 'back_to_item_options':
            await startMaterialIssue(bot, chatId, userInfo);
            break;
          case 'back_to_items':
            await showItemSelectionList(bot, chatId, session?.searchTerm, session?.currentPage);
            break;
          case 'back_to_quantity':
            const lastItem = session?.currentItem;
            if (lastItem) {
              await showQuantityInput(bot, chatId, lastItem.item_code, lastItem.item_name, lastItem.uom);
            }
            break;
          case 'back_to_work_item':
            await showWorkItemInput(bot, chatId);
            break;
          case 'back_to_location':
            await showLocationInput(bot, chatId);
            break;
          case 'add_another_item':
            await startMaterialIssue(bot, chatId, userInfo);
            break;
          case 'finish_items':
            await showWarehouseSelection(bot, chatId);
            break;
          case 'back_to_item_action':
            await showItemActionOptions(bot, chatId);
            break;
          case 'back_to_warehouses':
            await showWarehouseSelection(bot, chatId);
            break;
          case 'back_to_warehouse_selection':
            await showWarehouseSelection(bot, chatId);
            break;
          case 'back_to_user_search':
            await showUserSearchPrompt(bot, chatId);
            break;
          case 'back_to_approver_search':
            const requestId = data.split(':')[1];
            await showApproverSearchPrompt(bot, chatId, requestId);
            break;
          case 'cancel_process':
            userSessions.delete(chatId);
            await showPurposeOptions(chatId, bot, userInfo);
            break;
          case 'back_to_main':
            await showPurposeOptions(chatId, bot, userInfo);
            break;
          case 'view_status':
            bot.sendMessage(chatId, 'This feature is coming soon!');
            break;
          case 'help_support':
            bot.sendMessage(chatId, 'For help, please contact our support team.');
            break;
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
};

export default allowCors(handler);