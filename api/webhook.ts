import type { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';

dotenv.config();
const token = process.env.BOT_TOKEN || '8305223033:AAEGcYngeLYA9IUA6xIP43CUJfknN8zteKY';

// ERPNext configuration
const ERPNEXT_URL = process.env.ERPNEXT_URL;
const ERPNEXT_API_KEY = process.env.ERPNEXT_API_KEY;
const ERPNEXT_API_SECRET = process.env.ERPNEXT_API_SECRET;

// User sessions to track conversation state
const userSessions = new Map();

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

// ==================== SESSION TYPE ====================
type SimpleSession = {
  state: 'awaiting_item_selection' | 'awaiting_quantity' | 'awaiting_warehouse_selection' | 'submitting' | 'submission_failed' | 'searching_items';
  requestData: {
    items: Array<{ item_code: string; qty: number }>;
    warehouse?: string;
    purpose?: 'Material Issue' | 'Material Transfer' | 'Purchase';
  };
  currentItem?: { item_code?: string; qty?: number };
  lastError?: string;
  availableWarehouses?: Array<{ displayName: string; actualName: string }>;
  searchTerm?: string;
  availableItems?: Array<{ displayName: string; item_code: string; item_name: string }>;
};

// ==================== WELCOME & NAVIGATION FLOW ====================

/**
 * FLOW 1: Show main purpose options
 * User sees all available services
 */
const showPurposeOptions = async (chatId, bot) => {
  console.log('[showPurposeOptions] Showing purpose options to chat:', chatId);
  
  const message = `🏗️ *Tibeb Design & Build* 🏗️
╔═══════════════════════╗
   *Digital Transaction Bot*
╚═══════════════════════╝

🌟 *Your digital assistant for seamless transactions!*

📋 *Available Services:*
• Material request management
• Real-time status tracking  
• Quick digital approvals
• Instant notifications

🎯 *Please choose your action:*`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛒 CREATE MATERIAL REQUEST', callback_data: 'material_request' }],
        [{ text: '📊 VIEW REQUEST STATUS', callback_data: 'view_status' }],
        [{ text: '❓ HELP & SUPPORT', callback_data: 'help_support' }]
      ]
    }
  };
  
  return bot.sendMessage(chatId, message, options);
};

/**
 * FLOW 2: Show material request type options
 * User chooses between Material Issue, Transfer, or Purchase
 */
const showMaterialRequestOptions = async (chatId, bot) => {
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
 * FLOW 3: Start Material Issue Process
 * Initialize session for Material Issue and begin item selection
 */
const startMaterialIssue = async (bot, chatId) => {
  console.log('[startMaterialIssue] Starting material issue process for chat:', chatId);
  
  userSessions.set(chatId, {
    state: 'searching_items',
    requestData: { 
      items: [],
      purpose: 'Material Issue'
    },
    currentItem: {},
    searchTerm: '',
    availableItems: []
  });
  
  const searchOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔍 Search Items', callback: 'search_item' }],
        [{ text: '📋 Show All Items', callback: 'show_all_item' }],
        [{ text: '❌ Cancel' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
  
  return bot.sendMessage(chatId, 
    `📤 *Material Issue Process Started*\n\n🔍 How would you like to find items?\n\n• "Search Items" - Search by item name or code\n• "Show All Items" - Browse all available items\n\nChoose an option:`, 
    { ...searchOptions, parse_mode: 'Markdown' }
  );
};

// ==================== MATERIAL REQUEST CORE FUNCTIONS ====================

/**
 * FLOW 4: Handle item search input
 */
const handleItemSearch = async (bot, chatId) => {
  console.log('[handleItemSearch] Requesting search term from user');
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  session.state = 'awaiting_item_selection';
  userSessions.set(chatId, session);
  
  return bot.sendMessage(chatId, '🔍 Please enter your search term (item name or code):', {
    reply_markup: { remove_keyboard: true }
  });
};

/**
 * FLOW 5: Show item selection list
 */
const handleItemSelectionList = async (bot, chatId, searchTerm = '') => {
  console.log('[handleItemSelectionList] Showing items for chat:', chatId);
  
  try {
    // Simplified item search - implement your searchItemsSimple function here
    const items = await searchItems(searchTerm);
    
    if (items.length === 0) {
      const message = searchTerm ? 
        `❌ No items found matching "${searchTerm}".` : 
        `❌ No items found in the system.`;
      
      const retryOptions = {
        reply_markup: {
          keyboard: [
            [{ text: '🔍 Search Again' }],
            [{ text: '📋 Show All Items' }],
            [{ text: '❌ Cancel' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      };
      
      return bot.sendMessage(chatId, message + '\n\nPlease try a different search term.', retryOptions);
    }
    
    // Store items in session
    const session = userSessions.get(chatId);
    if (session) {
      session.availableItems = items.map(item => ({
        displayName: `${item.item_name || item.name} (${item.item_code || item.name})`,
        item_code: item.item_code || item.name,
        item_name: item.item_name || item.name
      }));
      userSessions.set(chatId, session);
    }
    
    // Create keyboard with items (limited to 20 for better UX)
    const itemsToShow = items.slice(0, 20);
    const keyboard = itemsToShow.map(item => [{ 
      text: `${item.item_name || item.name} (${item.item_code || item.name})` 
    }]);
    
    // Add navigation options
    keyboard.push([{ text: '🔍 New Search' }]);
    keyboard.push([{ text: '❌ Cancel' }]);
    
    const options = {
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
    
    let message = `📦 Select an item from the list:\n\n`;
    if (searchTerm) {
      message += `🔍 Search results for "${searchTerm}"\n`;
    }
    message += `📊 Found ${items.length} items`;
    if (items.length > 20) {
      message += ` (showing first 20)`;
    }
    
    return bot.sendMessage(chatId, message, options);
  } catch (error) {
    console.error('[handleItemSelectionList] Error:', error);
    return bot.sendMessage(chatId, '❌ Error loading items. Please try again.');
  }
};

/**
 * FLOW 6: Handle item selection
 */
const handleItemSelection = async (bot, chatId, itemText) => {
  console.log('[handleItemSelection] Handling selection:', itemText);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  // Handle navigation buttons
  if (itemText === '🔍 Search Items' || itemText === '🔍 New Search') {
    return handleItemSearch(bot, chatId);
  }
  
  if (itemText === '📋 Show All Items') {
    return handleItemSelectionList(bot, chatId, '');
  }
  
  // Handle search term input
  if (session.state === 'awaiting_item_selection' && 
      !itemText.startsWith('🔍') && 
      !itemText.startsWith('📋') && 
      !itemText.startsWith('❌') &&
      !session.availableItems?.some(item => item.displayName === itemText)) {
    
    session.searchTerm = itemText;
    userSessions.set(chatId, session);
    return handleItemSelectionList(bot, chatId, itemText);
  }
  
  // Handle actual item selection
  if (!itemText.startsWith('🔍') && !itemText.startsWith('📋') && !itemText.startsWith('❌')) {
    const selectedItem = session.availableItems?.find(item => item.displayName === itemText);
    
    if (selectedItem) {
      session.currentItem = { item_code: selectedItem.item_code };
      session.state = 'awaiting_quantity';
      userSessions.set(chatId, session);
      
      return bot.sendMessage(chatId, 
        `✅ Selected: ${itemText}\n\n📦 How many do you need? Please enter quantity:`, 
        { reply_markup: { remove_keyboard: true } }
      );
    }
  }
  
  return startMaterialIssue(bot, chatId);
};

/**
 * FLOW 7: Handle quantity input
 */
const handleQuantityInput = async (bot, chatId, quantity) => {
  console.log('[handleQuantityInput] Handling quantity:', quantity);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    return bot.sendMessage(chatId, '❌ Please enter a valid quantity (number greater than 0):');
  }
  
  session.currentItem.qty = qty;
  session.requestData.items.push({
    item_code: session.currentItem.item_code!,
    qty: session.currentItem.qty
  });
  
  session.state = 'awaiting_warehouse_selection';
  userSessions.set(chatId, session);
  
  await bot.sendMessage(chatId, 
    `✅ Quantity: ${qty}\n\n🏭 Loading available warehouses...`, 
    { reply_markup: { remove_keyboard: true } }
  );
  
  return handleWarehouseSelectionList(bot, chatId);
};

/**
 * FLOW 8: Show warehouse selection
 */
const handleWarehouseSelectionList = async (bot, chatId) => {
  console.log('[handleWarehouseSelectionList] Showing warehouses for chat:', chatId);
  
  try {
    const warehouses = await searchWarehouses('');
    
    if (warehouses.length === 0) {
      return bot.sendMessage(chatId, `❌ No warehouses found. Please try again later.`);
    }
    
    const session = userSessions.get(chatId);
    if (session) {
      session.availableWarehouses = warehouses.map(warehouse => ({
        displayName: warehouse.warehouse_name || warehouse.name,
        actualName: warehouse.name
      }));
      userSessions.set(chatId, session);
    }
    
    const keyboard = warehouses.map(warehouse => [{ 
      text: warehouse.warehouse_name || warehouse.name 
    }]);
    keyboard.push([{ text: '❌ Cancel' }]);
    
    const options = {
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
    
    return bot.sendMessage(chatId, 
      `🏭 Select a warehouse from the list (${warehouses.length} available):`, 
      options
    );
  } catch (error) {
    console.error('[handleWarehouseSelectionList] Error:', error);
    return bot.sendMessage(chatId, '❌ Error loading warehouses. Please try again:');
  }
};

/**
 * FLOW 9: Handle warehouse selection and create Material Issue
 */
const handleWarehouseSelection = async (bot, chatId, selectedWarehouseName) => {
  console.log('[handleWarehouseSelection] Handling warehouse selection:', selectedWarehouseName);
  
  const session = userSessions.get(chatId);
  if (!session) {
    return bot.sendMessage(chatId, '❌ Session expired. Please start over with /start.');
  }
  
  const validWarehouse = session.availableWarehouses?.find(
    wh => wh.displayName === selectedWarehouseName
  );
  
  if (!validWarehouse) {
    await bot.sendMessage(chatId, `❌ "${selectedWarehouseName}" is not a valid warehouse.`);
    return handleWarehouseSelectionList(bot, chatId);
  }
  
  session.requestData.warehouse = validWarehouse.actualName;
  
  // Show summary and create Material Issue
  const summary = `📋 *Material Issue Summary*\n\n` +
    `*Items:*\n${session.requestData.items.map((item, idx) => 
      `${idx + 1}. ${item.item_code} - Qty: ${item.qty}`
    ).join('\n')}\n\n` +
    `*Warehouse:* ${selectedWarehouseName}\n` +
    `*Purpose:* ${session.requestData.purpose}\n\n` +
    `⏳ Creating material issue...`;
  
  await bot.sendMessage(chatId, summary, { 
    parse_mode: 'Markdown',
    reply_markup: { remove_keyboard: true } 
  });
  
  try {
    // Create Material Issue in ERPNext
    const result = await createMaterialRequest({
      items: session.requestData.items,
      warehouse: session.requestData.warehouse,
      purpose: session.requestData.purpose,
      required_by: new Date().toISOString().split('T')[0]
    });
    
    const successMessage = `🎉 *Material Issue Created Successfully!*\n\n` +
      `*Items Issued:*\n${session.requestData.items.map((item, idx) => 
        `${idx + 1}. ${item.item_code} - Qty: ${item.qty}`
      ).join('\n')}\n\n` +
      `*From Warehouse:* ${selectedWarehouseName}\n` +
      `*Reference:* ${result.data.name}\n` +
      `✅ *Status:* Submitted\n\n` +
      `Your material issue has been processed successfully!`;
    
    userSessions.delete(chatId);
    
    await bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
    return showPurposeOptions(chatId, bot);
    
  } catch (error) {
    console.error('[handleWarehouseSelection] Error:', error);
    await bot.sendMessage(chatId, 
      `❌ Failed to create material issue: ${error.message}\n\nPlease try again.`
    );
    userSessions.delete(chatId);
    return showPurposeOptions(chatId, bot);
  }
};

// ==================== UTILITY FUNCTIONS ====================

// Simplified versions of your existing functions
const searchItems = async (bot, searchTerm = '') => {
  // Implement your existing searchItemsSimple function here
  return []; // Placeholder
};


const showAllItems = async (searchTerm = '') => {
  // Implement your existing searchItemsSimple function here
  return []; // Placeholder
};

const searchWarehouses = async (searchTerm = '') => {
  // Implement your existing searchWarehouses function here  
  return []; // Placeholder
};

const createMaterialRequest = async (materialRequestData) => {
  // Implement your existing createMaterialRequest function here
  // Make sure to set material_request_type based on purpose
  return { data: { name: 'MAT-ISSUE-2024-001' } }; // Placeholder
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
  const bot = new TelegramBot(token);

  try {
    if (body.message) {
      const { chat, text, from } = body.message;
      const chatId = chat.id;
      const session = userSessions.get(chatId);

      console.log('[handler] Processing message from:', from?.first_name, 'Chat ID:', chatId, 'Text:', text);

      // Handle /start command
      if (text === '/start') {
        await showPurposeOptions(chatId, bot);
        return res.status(200).json({ status: 'ok' });
      }

      // Handle cancel in active session
      if (text === '❌ Cancel' && session) {
        userSessions.delete(chatId);
        await bot.sendMessage(chatId, '❌ Request cancelled.');
        await showPurposeOptions(chatId, bot);
        return res.status(200).json({ status: 'ok' });
      }

      // Process session states
      if (session) {
        switch (session.state) {
          case 'searching_items':
            if (text === '🔍 Search Items') {
              await handleItemSearch(bot, chatId);
            } else if (text === '📋 Show All Items') {
              await handleItemSelectionList(bot, chatId, '');
            } else {
              await handleItemSelection(bot, chatId, text);
            }
            break;
            
          case 'awaiting_item_selection':
            await handleItemSelection(bot, chatId, text);
            break;
            
          case 'awaiting_quantity':
            await handleQuantityInput(bot, chatId, text);
            break;
            
          case 'awaiting_warehouse_selection':
            await handleWarehouseSelection(bot, chatId, text);
            break;
            
          default:
            await bot.sendMessage(chatId, '❌ Invalid state. Please start over.');
            userSessions.delete(chatId);
            await showPurposeOptions(chatId, bot);
        }
        return res.status(200).json({ status: 'ok' });
      }

      // No active session
      await showPurposeOptions(chatId, bot);

    } else if (body.callback_query) {
      // Handle inline button callbacks
      const { data, message } = body.callback_query;
      const chatId = message.chat.id;

      console.log('[handler] Processing callback:', data);

      switch (data) {
        case 'material_request':
          await showMaterialRequestOptions(chatId, bot);
          break;
          
        case 'material_issue':
          await startMaterialIssue(bot, chatId);
          break;
        case 'search_item':
          await searchItems(bot, chatId);
          break;
        case 'show_all_item':
          await showAllItems(bot,);
          break;
          
        case 'material_transfer':
          await bot.sendMessage(chatId, '🔄 Material Transfer - This feature is coming soon!');
          await showPurposeOptions(chatId, bot);
          break;
          
        case 'material_purchase':
          await bot.sendMessage(chatId, '🛒 Material Purchase - This feature is coming soon!');
          await showPurposeOptions(chatId, bot);
          break;
          
        case 'view_status':
          await bot.sendMessage(chatId, '📊 View Request Status - This feature is coming soon!');
          await showPurposeOptions(chatId, bot);
          break;
          
        case 'help_support':
          await bot.sendMessage(chatId, '❓ Help & Support - Contact administrator for assistance.');
          await showPurposeOptions(chatId, bot);
          break;
          
        case 'back_to_main':
          await showPurposeOptions(chatId, bot);
          break;
          
        default:
          await bot.sendMessage(chatId, '❌ Unknown option. Please try again.');
          await showPurposeOptions(chatId, bot);
      }
    }

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('[handler] ERROR:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default allowCors(handler);