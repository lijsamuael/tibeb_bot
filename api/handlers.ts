import TelegramBot from 'node-telegram-bot-api';
import { searchItems, searchWarehouses, searchUsers, createMaterialRequest, checkAllItemBalances, updateMaterialRequestStatus, submitMaterialRequest } from './erpnext';

// User sessions to track conversation state
export const userSessions = new Map();

// Temporary store for active material requests (keyed by requestId)
// In a real application, this should be a database.
export const activeRequests = new Map();

// ==================== SESSION TYPE ====================
type SimpleSession = {
  state: 'awaiting_item_selection' | 'awaiting_quantity' | 'awaiting_work_item' | 'awaiting_location' | 'awaiting_qty_of_work' | 'awaiting_warehouse_selection' | 'awaiting_user_selection' | 'awaiting_item_action' | 'submitting' | 'searching_items';
  requestData: {
    items: Array<{
      item_code: string;
      qty: number;
      uom?: string;
      work_item?: string;
      location?: string;
      qty_of_work?: string;
    }>;
    warehouse?: string;
    purpose?: 'Material Issue' | 'Material Transfer' | 'Purchase';
    assign_to?: string;
    requested_by?: string;
    userid?: string;
  };
  currentItem?: {
    item_code?: string;
    qty?: number;
    uom?: string;
    work_item?: string;
    location?: string;
    qty_of_work?: string;
    item_name?: string;
  };
  lastError?: string;
  availableWarehouses?: Array<{ displayName: string; actualName: string }>;
  availableUsers?: Array<{ displayName: string; actualName: string; telegramId?: string }>;
  searchTerm?: string;
  availableItems?: Array<{ displayName: string; item_code: string; item_name: string; stock_uom?: string }>;
  currentPage?: number;
  userInfo?: {
    username?: string;
    userid?: string;
    full_name?: string;
  };
};

// ==================== WELCOME & NAVIGATION FLOW ====================

/**
 * FLOW 1: Show main purpose options
 */
/**
 * FLOW 1: Show main purpose options
 */
export const showPurposeOptions = async (chatId, bot, userInfo = {}) => {
  console.log('[showPurposeOptions] Showing purpose options to chat:', chatId);
  
  const message = `🏗️ *Tibeb Design & Build* 🏗️
╔═══════════════════════╗
   *Digital Transaction Bot*
╚═══════════════════════╝

🌟 *Your digital assistant for seamless transactions!*

📋 *Available Services:*
• Maintenance request management
• Material request management  
• Real-time status tracking  
• Quick digital approvals
• Instant notifications

🎯 *Please choose your action:*`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🐛 CREATE MAINTENANCE REQUEST', callback_data: 'issue_request' }],
        [{ text: '🛒 CREATE MATERIAL REQUEST', callback_data: 'material_request' }],
        [{ text: '📦 CREATE PURCHASE ORDER', callback_data: 'create_purchase_order' }],
        [{ text: '📊 VIEW REQUEST STATUS', callback_data: 'view_status' }],
        [{ text: '❓ HELP & SUPPORT', callback_data: 'help_support' }]
      ]
    }
  };
  
  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 2: Show material request type options
 */
export const showMaterialRequestOptions = async (chatId, bot) => {
  console.log('[showMaterialRequestOptions] Showing material request options to chat:', chatId);
  
  const message = `🎯 *Please choose request type:*`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📤 MATERIAL ISSUE', callback_data: 'material_issue' }],
        [{ text: '🔄 MATERIAL TRANSFER', callback_data: 'material_transfer' }],
        [{ text: '🛒 MATERIAL PURCHASE', callback_data: 'material_purchase' }],
        [{ text: '⬅️ BACK', callback_data: 'back_to_main' }]
      ]
    }
  };
  
  return bot.sendMessage(chatId, message, options);
};

/**
 * Generic function to start a material request process (Issue or Purchase)
 */
const startMaterialRequestProcess = async (bot, chatId, userInfo, purpose) => {
  console.log(`[startMaterialRequestProcess] Starting ${purpose} process for chat:`, chatId);

  userSessions.set(chatId, {
    state: 'searching_items',
    requestData: {
      items: [],
      purpose: purpose, // Use the provided purpose
      requested_by: userInfo?.full_name || userInfo?.username,
      userid: userInfo?.userid
    },
    currentItem: {},
    searchTerm: '',
    availableItems: [],
    currentPage: 0,
    userInfo: userInfo
  });

  const title = purpose === 'Material Issue' ? '📤 Material Issue' : '🛒 Material Purchase';
  const message = `*${title} Process Started*\n\n🔍 How would you like to find items?`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔍 SEARCH ITEMS', callback_data: 'search_items' }],
        [{ text: '📋 SHOW ALL ITEMS', callback_data: 'show_all_items' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };

  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 3A: Start Material Issue Process
 */
export const startMaterialIssue = async (bot, chatId, userInfo) => {
  return startMaterialRequestProcess(bot, chatId, userInfo, 'Material Issue');
};

/**
 * FLOW 3B: Start Material Purchase Process
 */
export const startMaterialPurchase = async (bot, chatId, userInfo) => {
  return startMaterialRequestProcess(bot, chatId, userInfo, 'Purchase');
};

/**
 * FLOW 3C: Start Purchase Order Process
 */
export const startPurchaseOrderProcess = async (bot, chatId, userInfo) => {
  console.log('[startPurchaseOrderProcess] Showing Purchase Order options for chat:', chatId);

  const message = '📦 *Purchase Order Menu*\n\nWhat would you like to do?';
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📝 CREATE NEW PURCHASE ORDER', callback_data: 'new_purchase_order' }],
        [{ text: '📋 VIEW PURCHASE ORDER LIST', callback_data: 'view_purchase_orders' }],
        [{ text: '⬅️ BACK', callback_data: 'back_to_main' }]
      ]
    }
  };

  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 4: Show search input prompt
 */
export const showSearchPrompt = async (bot, chatId) => {
  console.log('[showSearchPrompt] Showing search prompt for chat:', chatId);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  session.state = 'awaiting_item_selection';
  userSessions.set(chatId, session);
  
  const message = `🔍 *Enter Search Term*\n\nPlease type the item name or code you're looking for:`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅️ BACK', callback_data: 'back_to_item_options' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };
  
  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 5: Show item selection list with pagination
 */
export const showItemSelectionList = async (bot, chatId, searchTerm = '', page = 0) => {
  console.log('[showItemSelectionList] Showing items for chat:', chatId, 'Search term:', searchTerm, 'Page:', page);
  
  try {
    const items = await searchItems(searchTerm);
    
    if (items.length === 0) {
      const message = searchTerm ? 
        `❌ No items found matching "${searchTerm}".` : 
        `❌ No items found in the system.`;
      
      const options = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 SEARCH AGAIN', callback_data: 'search_items' }],
            [{ text: '📋 SHOW ALL ITEMS', callback_data: 'show_all_items' }],
            [{ text: '⬅️ BACK', callback_data: 'back_to_item_options' }],
            [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
          ]
        }
      };
      
      return bot.sendMessage(chatId, message, options);
    }
    
    // Store items in session
    const session = userSessions.get(chatId);
    if (session) {
      session.availableItems = items.map(item => ({
        displayName: `${item.item_name || item.name} (${item.item_code || item.name})`,
        item_code: item.item_code || item.name,
        item_name: item.item_name || item.name,
        stock_uom: item.stock_uom || 'Nos'
      }));
      session.currentPage = page;
      userSessions.set(chatId, session);
    }
    
    // Pagination - 8 items per page
    const itemsPerPage = 8;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToShow = items.slice(startIndex, endIndex);
    
    // Create inline keyboard with items
    const itemButtons = itemsToShow.map(item => [
      { 
        text: `📦 ${item.item_name || item.name}`, 
        callback_data: `select_item:${item.item_code || item.name}` 
      }
    ]);
    
    // Add pagination buttons if needed
    const paginationButtons = [];
    if (totalPages > 1) {
      if (page > 0) {
        paginationButtons.push({ text: '⬅️ Previous', callback_data: `item_page:${page - 1}:${searchTerm}` });
      }
      if (page < totalPages - 1) {
        paginationButtons.push({ text: 'Next ➡️', callback_data: `item_page:${page + 1}:${searchTerm}` });
      }
    }
    
    const navigationButtons = [];
    if (searchTerm) {
      navigationButtons.push({ text: '🔍 NEW SEARCH', callback_data: 'search_items' });
    }
    navigationButtons.push({ text: '📋 SHOW ALL', callback_data: 'show_all_items' });
    navigationButtons.push({ text: '⬅️ BACK', callback_data: 'back_to_item_options' });
    navigationButtons.push({ text: '❌ CANCEL', callback_data: 'cancel_process' });
    
    const inline_keyboard = [
      ...itemButtons,
      ...(paginationButtons.length > 0 ? [paginationButtons] : []),
      navigationButtons
    ];
    
    let message = `📦 *Select an Item*`;
    if (searchTerm) {
      message += `\n🔍 Search results for "${searchTerm}"`;
    } else {
      message += `\n📋 All available items`;
    }
    message += `\n📊 Found ${items.length} items`;
    if (totalPages > 1) {
      message += `\n📄 Page ${page + 1} of ${totalPages}`;
    }
    
    const options = {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard }
    };
    
    return bot.sendMessage(chatId, message, options);
  } catch (error) {
    console.error('[showItemSelectionList] Error:', error);
    
    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 TRY AGAIN', callback_data: 'show_all_items' }],
          [{ text: '⬅️ BACK', callback_data: 'back_to_item_options' }],
          [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
        ]
      }
    };
    
    return bot.sendMessage(chatId, '❌ Error loading items. Please try again.', options);
  }
};

/**
 * FLOW 6: Show quantity input with UOM
 */
export const showQuantityInput = async (bot, chatId, itemCode, itemName, uom = 'Nos') => {
  console.log('[showQuantityInput] Showing quantity input for item:', itemCode, 'UOM:', uom);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  session.currentItem = { 
    item_code: itemCode, 
    item_name: itemName,
    uom: uom
  };
  session.state = 'awaiting_quantity';
  userSessions.set(chatId, session);
  
  const message = `✅ *Selected:* ${itemName}\n\n📦 *Enter Quantity*\n\nPlease type the quantity you need (in ${uom}):`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅️ BACK TO ITEMS', callback_data: 'back_to_items' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };
  
  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 7: Show work item input
 */
export const showWorkItemInput = async (bot, chatId) => {
  console.log('[showWorkItemInput] Showing work item input for chat:', chatId);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  session.state = 'awaiting_work_item';
  userSessions.set(chatId, session);
  
  const message = `🔧 *Enter Work Item*\n\nPlease specify the work item for ${session.currentItem?.item_name}:`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅️ BACK', callback_data: 'back_to_quantity' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };
  
  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 8: Show location input
 */
export const showLocationInput = async (bot, chatId) => {
  console.log('[showLocationInput] Showing location input for chat:', chatId);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  session.state = 'awaiting_location';
  userSessions.set(chatId, session);
  
  const message = `📍 *Enter Location*\n\nPlease specify the location for ${session.currentItem?.item_name}:`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅️ BACK', callback_data: 'back_to_work_item' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };
  
  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 9: Show quantity of work input
 */
export const showQtyOfWorkInput = async (bot, chatId) => {
  console.log('[showQtyOfWorkInput] Showing quantity of work input for chat:', chatId);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  session.state = 'awaiting_qty_of_work';
  userSessions.set(chatId, session);
  
  const message = `📊 *Enter Quantity of Work*\n\nPlease specify the quantity of work for ${session.currentItem?.item_name}:`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅️ BACK', callback_data: 'back_to_location' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };
  
  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 10: Show item action options (add another or finish)
 */
export const showItemActionOptions = async (bot, chatId) => {
  console.log('[showItemActionOptions] Showing item action options for chat:', chatId);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  session.state = 'awaiting_item_action';
  userSessions.set(chatId, session);
  
  const currentItems = session.requestData.items.map((item, index) => 
    `${index + 1}. ${item.item_code} - Qty: ${item.qty} ${item.uom || 'Nos'}`
  ).join('\n');
  
  const message = `✅ *Item Added Successfully!*\n\n*Current Items:*\n${currentItems}\n\nWhat would you like to do next?`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ ADD ANOTHER ITEM', callback_data: 'add_another_item' }],
        [{ text: '✅ FINISH & SELECT WAREHOUSE', callback_data: 'finish_items' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };
  
  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 11: Show warehouse selection
 */
export const showWarehouseSelection = async (bot, chatId) => {
  console.log('[showWarehouseSelection] Showing warehouses for chat:', chatId);
  
  try {
    const warehouses = await searchWarehouses('');
    
    if (warehouses.length === 0) {
      const options = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 TRY AGAIN', callback_data: 'back_to_warehouses' }],
            [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
          ]
        }
      };
      
      return bot.sendMessage(chatId, '❌ No warehouses found. Please try again later.', options);
    }
    
    const session = userSessions.get(chatId);
    if (session) {
      session.availableWarehouses = warehouses.map(warehouse => ({
        displayName: warehouse.warehouse_name || warehouse.name,
        actualName: warehouse.name
      }));
      userSessions.set(chatId, session);
    }
    
    // Create warehouse buttons (2 per row)
    const warehouseButtons = [];
    for (let i = 0; i < warehouses.length; i += 2) {
      const row = [];
      if (warehouses[i]) {
        row.push({ 
          text: `🏭 ${warehouses[i].warehouse_name || warehouses[i].name}`, 
          callback_data: `select_warehouse:${warehouses[i].name}` 
        });
      }
      if (warehouses[i + 1]) {
        row.push({ 
          text: `🏭 ${warehouses[i + 1].warehouse_name || warehouses[i + 1].name}`, 
          callback_data: `select_warehouse:${warehouses[i + 1].name}` 
        });
      }
      warehouseButtons.push(row);
    }
    
    const inline_keyboard = [
      ...warehouseButtons,
      [{ text: '⬅️ BACK TO ITEMS', callback_data: 'back_to_item_action' }],
      [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
    ];
    
    const message = `🏭 *Select Warehouse*\n\nChoose a warehouse from the list below:`;
    
    const options = {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard }
    };
    
    return bot.sendMessage(chatId, message, options);
  } catch (error) {
    console.error('[showWarehouseSelection] Error:', error);
    
    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 TRY AGAIN', callback_data: 'back_to_warehouses' }],
          [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
        ]
      }
    };
    
    return bot.sendMessage(chatId, '❌ Error loading warehouses. Please try again.', options);
  }
};

/**
 * FLOW 12: Show user search prompt
 */
export const showUserSearchPrompt = async (bot, chatId) => {
  console.log('[showUserSearchPrompt] Showing search prompt for chat:', chatId);

  const session = userSessions.get(chatId);
  if (!session) {
    // If there's no session, we can't proceed. This is an edge case.
    return bot.sendMessage(chatId, '❌ Your session has expired. Please start over.');
  }
  
  session.state = 'awaiting_user_search';
  userSessions.set(chatId, session);

  const message = `👤 *Assign To User*\n\nPlease type the name of the user to search for:`;
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅️ BACK', callback_data: 'back_to_warehouse_selection' }],
        [{ text: '🔍 SEARCH USERS', callback_data: 'search_users' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };

  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 13: Show user selection list
 */
export const showUserSelectionList = async (bot, chatId, searchTerm, page = 0) => {
  console.log('[showUserSelectionList] Showing users for chat:', chatId);

  try {
    const users = await searchUsers(searchTerm);
    
    if (users.length === 0) {
      return bot.sendMessage(chatId, '❌ No users found matching that name. Please try another search.');
    }

    const session = userSessions.get(chatId);
    if (session) {
      session.availableUsers = users.map(user => ({
        displayName: user.full_name || user.name,
        actualName: user.name,
        telegramId: user.telegram_user_id
      }));
      session.state = 'awaiting_user_selection';
      userSessions.set(chatId, session);
    }

    const ITEMS_PER_PAGE = 5;
    const startIndex = page * ITEMS_PER_PAGE;
    const paginatedUsers = users.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const userButtons = paginatedUsers.map(user => [
      { text: `👤 ${user.full_name || user.name}`, callback_data: `select_user:${user.name}` }
    ]);

    const navigationButtons = [];
    if (page > 0) {
      navigationButtons.push({ text: '⬅️ PREV', callback_data: `user_page:${page - 1}:${searchTerm}` });
    }
    if (users.length > startIndex + ITEMS_PER_PAGE) {
      navigationButtons.push({ text: 'NEXT ➡️', callback_data: `user_page:${page + 1}:${searchTerm}` });
    }

    const inline_keyboard = [
      ...userButtons,
      navigationButtons,
      [{ text: '⬅️ BACK TO SEARCH', callback_data: 'back_to_user_search' }],
      [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
    ];

    const message = `👤 *Assign To User*\n\nChoose a user to assign this request to:`;
    const options = { parse_mode: 'Markdown', reply_markup: { inline_keyboard } };
    
    return bot.sendMessage(chatId, message, options);

  } catch (error) {
    console.error('[showUserSelectionList] Error:', error);
    return bot.sendMessage(chatId, '❌ Error loading users. Please try again.');
  }
};

/**
 * FLOW 13: Handle warehouse selection and transition to user selection
 */
export const handleWarehouseSelection = async (bot, chatId, warehouseName) => {
  console.log('[handleWarehouseSelection] Handling warehouse selection:', warehouseName);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  const validWarehouse = session.availableWarehouses?.find(
    wh => wh.actualName === warehouseName
  );
  
  if (!validWarehouse) {
    return showWarehouseSelection(bot, chatId);
  }
  
  session.requestData.warehouse = validWarehouse.actualName;
  session.state = 'awaiting_user_search'; // Set state for the next step
  userSessions.set(chatId, session);

  // Transition to the next step: user search
  return showUserSearchPrompt(bot, chatId);
};

/**
 * FLOW 14: Handle user selection and create Material Request
 */
// IMPORTANT: Replace these placeholder IDs with the actual numerical Telegram Chat IDs.
// You can get any user's ID by having them message the @userinfobot on Telegram.

export const handleUserSelection = async (bot, chatId, userName) => {
  console.log('[handleUserSelection] Handling user selection:', userName);

  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }

  // Validate that required data exists before creating the request
  if (!session.requestData.items || session.requestData.items.length === 0 || !session.requestData.warehouse) {
    userSessions.delete(chatId);
    await bot.sendMessage(chatId, 'Critical data is missing (items or warehouse). Your session has been reset. Please start a new request.');
    return showPurposeOptions(chatId, bot, session.userInfo);
  }

  const validUser = session.availableUsers?.find(u => u.actualName === userName);
  if (!validUser) {
    return showUserSearchPrompt(bot, chatId);
  }

  session.requestData.assign_to = validUser.actualName;

  const requestType = session.requestData.purpose === 'Material Issue' ? 'Material Issue' : 'Material Purchase';
  const warehouseInfo = session.availableWarehouses?.find(wh => wh.actualName === session.requestData.warehouse);

  const summary = `📋 *${requestType} Summary*\n\n` +
    `*Items:*\n${session.requestData.items.map((item, idx) => 
      `${idx + 1}. ${item.item_code} - Qty: ${item.qty} ${item.uom || 'Nos'}`
    ).join('\n')}\n\n` +
    `*Warehouse:* ${warehouseInfo?.displayName || session.requestData.warehouse}\n` +
    `*Assigned To:* ${validUser.displayName}\n` +
    `*Purpose:* ${session.requestData.purpose}\n` +
    `*Requested By:* ${session.requestData.requested_by || 'N/A'}\n\n` +
    `⏳ Creating ${requestType.toLowerCase()}...`;

  await bot.sendMessage(chatId, summary, { parse_mode: 'Markdown' });

  try {
    const result = await createMaterialRequest(session.requestData, session.userInfo);
    
    const successMessage = `🎉 *${requestType} Created Successfully!*\n\n` +
      `*Reference:* ${result.data.name}\n` +
      `*Assigned To:* ${validUser.displayName}\n` +
      `✅ *Status:* Submitted for checking\n\n` +
      `You will be notified once the request is reviewed.`;

    // Notify the Checker
    const checkerNotification = `🔔 *New Material Request for Checking*\n\n` +
      `*Request ID:* ${result.data.name}\n` +
      `*Requested By:* ${session.requestData.requested_by}\n` +
      `*Assigned To:* ${validUser.displayName}\n` +
      `*Items:*\n${session.requestData.items.map(item => `  - ${item.item_code} (Qty: ${item.qty})`).join('\n')}`;

    const checkerOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 CHECK ITEM BALANCE', callback_data: `check_balance:${result.data.name}` }],
          [{ text: '🎬 TAKE ACTION', callback_data: `checker_action:${result.data.name}` }]
        ]
      }
    };

    // Save request details for the checker/approver flow
    activeRequests.set(result.data.name, {
      items: session.requestData.items,
      requester: session.requestData.requested_by,
      assignee: validUser.displayName
    });

    userSessions.delete(chatId);

    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ SUBMIT FOR APPROVAL', callback_data: `submit_request:${result.data.name}` }],
          [{ text: '🔍 SEARCH USERS', callback_data: 'search_users' }],
          [{ text: '❌ DISCARD DRAFT', callback_data: 'cancel_process' }]
        ]
      }
    };

    return bot.sendMessage(chatId, successMessage, options);

  } catch (error) {
    console.error('[handleUserSelection] Error:', error);
    userSessions.delete(chatId);
    return bot.sendMessage(chatId, `❌ Failed to create ${requestType.toLowerCase()}: ${error.message}`);
  }
};

/**
 * FLOW 15: Handle 'Check Balance' action for a Checker
 */
export const handleCheckBalance = async (bot, chatId, requestId) => {
  console.log('[handleCheckBalance] Checker requested balance for request:', requestId);

  try {
    const requestDetails = activeRequests.get(requestId);
    if (!requestDetails || !requestDetails.items) {
      return bot.sendMessage(chatId, '❌ Request details not found. It might be too old.');
    }

    await bot.sendMessage(chatId, '⏳ Fetching latest stock balances...');

    const itemCodes = requestDetails.items.map(item => item.item_code);
    const balances = await checkAllItemBalances(itemCodes);

    let balanceMessage = `📊 *Stock Balance Report for Request ${requestId}*\n\n`;
    if (balances && Object.keys(balances).length > 0) {
      for (const itemCode in balances) {
        balanceMessage += `*${itemCode}:* ${balances[itemCode]} Nos\n`;
      }
    } else {
      balanceMessage += 'No balance information found for the requested items.';
    }

    return bot.sendMessage(chatId, balanceMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('[handleCheckBalance] Error:', error);
    return bot.sendMessage(chatId, '❌ Error checking balances. Please try again.');
  }
};

/**
 * FLOW 16: Show 'Take Action' options to a Checker
 */
export const showCheckerActionOptions = async (bot, chatId, requestId) => {
  console.log('[showCheckerActionOptions] Showing actions for request:', requestId);

  const message = `🎬 *Take Action*\n\nSelect an action for request *${requestId}*:`;
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ CONFIRM CHECK', callback_data: `checker_confirm:${requestId}` }],
        [{ text: '❌ CANCEL REQUEST', callback_data: `checker_cancel:${requestId}` }]
      ]
    }
  };

  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 17: Handle Checker's 'Confirm Check' action
 */
/**
 * FLOW 15: Handle the requester's final submission of the Material Request
 */
export const showApproverSearchPrompt = async (bot, chatId, requestId) => {
  console.log('[showApproverSearchPrompt] Showing search prompt for request:', requestId);

  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Your session has expired. Please start over.');
  }

  session.state = 'awaiting_approver_search';
  userSessions.set(chatId, session);

  const message = `👤 *Select Approver*\n\nPlease type the name of the user to approve this request:`;
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ CANCEL', callback_data: `checker_cancel:${requestId}` }]
      ]
    }
  };

  return bot.sendMessage(chatId, message, options);
};

export const handleRequestSubmission = async (bot, chatId, requestId) => {
  console.log('[handleRequestSubmission] Submitting request:', requestId);

  try {
    // Change the state from 'Draft' to 'Requested'
    await updateMaterialRequestStatus(requestId, 'Requested');

    const requestDetails = activeRequests.get(requestId);
    if (!requestDetails) {
      return bot.sendMessage(chatId, '❌ Request details not found. Cannot send notification.');
    }

    // Notify the Checker
    const checkerNotification = `🔔 *New Material Request for Checking*\n\n` +
      `*Request ID:* ${requestId}\n` +
      `*Requested By:* ${requestDetails.requester}\n` +
      `*Assigned To:* ${requestDetails.assignee}\n` +
      `*Items:*\n${requestDetails.items.map(item => `  - ${item.item_code} (Qty: ${item.qty})`).join('\n')}`;

    const checkerOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 CHECK ITEM BALANCE', callback_data: `check_balance:${requestId}` }],
          [{ text: '🎬 TAKE ACTION', callback_data: `checker_action:${requestId}` }]
        ]
      }
    };

    // We need to find the checker's telegram ID again
    const users = await searchUsers(requestDetails.assignee);
    const checker = users.find(u => u.name === requestDetails.assignee || u.full_name === requestDetails.assignee);

    if (checker && checker.telegram_user_id && String(checker.telegram_user_id).trim()) {
      bot.sendMessage(checker.telegram_user_id, checkerNotification, checkerOptions).catch(err => {
        console.error(`Failed to send notification to ${checker.telegram_user_id}:`, err.message);
      });
    } else {
      console.warn(`Checker ${requestDetails.assignee} does not have a valid Telegram ID.`);
    }

    await bot.sendMessage(chatId, `✅ *Request ${requestId} has been submitted successfully!*\n\nThe assigned checker has been notified.`);

    const finalOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 CREATE NEW REQUEST', callback_data: 'material_request' }],
          [{ text: '🏠 MAIN MENU', callback_data: 'back_to_main' }]
        ]
      }
    };

    return bot.sendMessage(chatId, 'What would you like to do next?', finalOptions);

  } catch (error) {
    console.error('[handleRequestSubmission] Error:', error);
    return bot.sendMessage(chatId, `❌ Failed to submit request: ${error.message}`);
  }
};



export const showApproverSelectionList = async (bot, chatId, requestId, searchTerm, page = 0) => {
  console.log('[showApproverSelectionList] Searching for approvers with term:', searchTerm);

  try {
    const users = await searchUsers(searchTerm);
    if (users.length === 0) {
      return bot.sendMessage(chatId, '❌ No users found. Please try another search.');
    }

    const ITEMS_PER_PAGE = 5;
    const startIndex = page * ITEMS_PER_PAGE;
    const paginatedUsers = users.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const userButtons = paginatedUsers.map(user => [
      { text: `👤 ${user.full_name || user.name}`, callback_data: `select_approver:${requestId}:${user.name}` }
    ]);

    const navigationButtons = [];
    if (page > 0) {
      navigationButtons.push({ text: '⬅️ PREV', callback_data: `approver_page:${requestId}:${page - 1}:${searchTerm}` });
    }
    if (users.length > startIndex + ITEMS_PER_PAGE) {
      navigationButtons.push({ text: 'NEXT ➡️', callback_data: `approver_page:${requestId}:${page + 1}:${searchTerm}` });
    }

    const inline_keyboard = [
      ...userButtons,
      navigationButtons,
      [{ text: '⬅️ BACK TO SEARCH', callback_data: `back_to_approver_search:${requestId}` }]
    ];

    const message = `👥 *Select an Approver*\n\nChoose a user to approve request *${requestId}*:`;
    const options = { parse_mode: 'Markdown', reply_markup: { inline_keyboard } };
    return bot.sendMessage(chatId, message, options);

  } catch (error) {
    console.error('[showApproverSelectionList] Error:', error);
    return bot.sendMessage(chatId, '❌ Error loading users.');
  }
};

export const handleCheckerConfirm = async (bot, chatId, requestId) => {
  console.log('[handleCheckerConfirm] Checker confirmed request:', requestId);

  try {
    await updateMaterialRequestStatus(requestId, 'Checked');
    await bot.sendMessage(chatId, `✅ Request *${requestId}* has been marked as 'Checked'.`);

    // Use the session to transition to the approver selection step
    const session = userSessions.get(chatId) || { requestData: { items: [] } };
    session.state = 'awaiting_approver_search';
    session.requestId = requestId;
    userSessions.set(chatId, session);

    return showApproverSearchPrompt(bot, chatId, requestId);

  } catch (error) {
    console.error('[handleCheckerConfirm] Error:', error);
    return bot.sendMessage(chatId, '❌ Failed to confirm check. Please try again.');
  }
};

/**
 * FLOW 18: Handle Checker's 'Cancel Request' action
 */
export const handleCheckerCancel = async (bot, chatId, requestId) => {
  console.log('[handleCheckerCancel] Checker cancelled request:', requestId);

  try {
    await updateMaterialRequestStatus(requestId, 'Cancelled');
    // In a real app, you would also notify the original requester.
    return bot.sendMessage(chatId, `❌ Request *${requestId}* has been cancelled successfully.`);

  } catch (error) {
    console.error('[handleCheckerCancel] Error:', error);
    return bot.sendMessage(chatId, '❌ Failed to cancel request. Please try again.');
  }
};

/**
 * FLOW 19: Handle Approver Selection and Notify Approver
 */
export const handleApproverSelection = async (bot, chatId, requestId, approverName) => {
  console.log(`[handleApproverSelection] Approver selected for ${requestId}:`, approverName);

  try {
    const users = await searchUsers(approverName);
    const approver = users.find(u => u.name === approverName);

    if (!approver || !approver.telegram_user_id || !String(approver.telegram_user_id).trim()) {
      return bot.sendMessage(chatId, `⚠️ User *${approverName}* does not have a valid Telegram ID. Please select another user.`);
    }

    const requestDetails = activeRequests.get(requestId);
    const approverNotification = `🔔 *New Material Request for Approval*\n\n` +
      `*Request ID:* ${requestId}\n` +
      `*Requested By:* ${requestDetails?.requester}\n` +
      `*Assigned To:* ${requestDetails?.assignee}\n` +
      `*Items:*\n${requestDetails?.items.map(item => `  - ${item.item_code} (Qty: ${item.qty})`).join('\n')}`;

    const approverOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '👍 APPROVE', callback_data: `approver_approve:${requestId}` }],
          [{ text: '👎 REJECT', callback_data: `approver_reject:${requestId}` }]
        ]
      }
    };

    await bot.sendMessage(approver.telegram_user_id, approverNotification, approverOptions).catch(err => {
      console.error(`Failed to send notification to approver ${approver.telegram_user_id}:`, err.message);
      bot.sendMessage(chatId, `⚠️ *Notification Failed:* Could not send a notification to *${approver.full_name || approver.name}*. Please select another user.`);
      throw new Error('Failed to send notification'); // Prevent success message from being sent
    });
    return bot.sendMessage(chatId, `✅ Notification sent to *${approver.full_name || approver.name}* for final approval.`);

  } catch (error) {
    console.error('[handleApproverSelection] Error:', error);
    return bot.sendMessage(chatId, '❌ Failed to send notification to approver.');
  }
};

/**
 * FLOW 20: Handle Approver's 'Approve' action
 */
export const handleApproverApprove = async (bot, chatId, requestId) => {
  console.log('[handleApproverApprove] Approver approved request:', requestId);

  try {
    await updateMaterialRequestStatus(requestId, 'Approved');
    // In a real app, notify the original requester and assignee.
    return bot.sendMessage(chatId, `✅ Request *${requestId}* has been approved.`);

  } catch (error) {
    console.error('[handleApproverApprove] Error:', error);
    return bot.sendMessage(chatId, '❌ Failed to approve request. Please try again.');
  }
};

/**
 * FLOW 21: Handle Approver's 'Reject' action
 */
export const handleApproverReject = async (bot, chatId, requestId) => {
  console.log('[handleApproverReject] Approver rejected request:', requestId);

  try {
    await updateMaterialRequestStatus(requestId, 'Rejected');
    // In a real app, notify the original requester and assignee.
    return bot.sendMessage(chatId, `❌ Request *${requestId}* has been rejected.`);

  } catch (error) {
    console.error('[handleApproverReject] Error:', error);
    return bot.sendMessage(chatId, '❌ Failed to reject request. Please try again.');
  }
};