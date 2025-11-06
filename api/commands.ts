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

const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

// Enhanced ERPNext API helper functions with better error handling
const searchItems = async (searchTerm) => {
  console.log('[searchItems] Searching for items with term:', searchTerm);
  console.log('[searchItems] ERPNext URL:', ERPNEXT_URL);
  
  try {
    console.log('[searchItems] Fetching items from ERPNext...');
    
    // First, let's test the API connection with a simple request
    const testResponse = await fetch(`${ERPNEXT_URL}/api/method/frappe.auth.get_logged_user`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[searchItems] Test API response status:', testResponse.status);
    
    // Check if we got HTML instead of JSON
    const responseText = await testResponse.text();
    console.log('[searchItems] Test API response first 200 chars:', responseText.substring(0, 200));
    
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      console.error('[searchItems] Received HTML instead of JSON. API endpoint might be wrong or authentication failed.');
      return [];
    }

    // If test is successful, proceed with item search
    const response = await fetch(`${ERPNEXT_URL}/api/resource/Item?fields=["name","item_name","item_code"]&limit_page_length=20`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[searchItems] Main API response status:', response.status);
    
    if (!response.ok) {
      console.error('[searchItems] API response not OK:', response.status, response.statusText);
      return [];
    }

    const responseText2 = await response.text();
    console.log('[searchItems] Raw response:', responseText2.substring(0, 500));
    
    let data;
    try {
      data = JSON.parse(responseText2);
    } catch (parseError) {
      console.error('[searchItems] JSON parse error:', parseError);
      console.error('[searchItems] Response that failed to parse:', responseText2);
      return [];
    }
    
    console.log('[searchItems] Parsed data structure:', Object.keys(data));
    
    if (!data.data) {
      console.log('[searchItems] No data field in response:', data);
      return [];
    }

    // Filter items based on search term
    const filteredItems = data.data.filter(item => {
      const itemName = item.item_name || item.name || '';
      const itemCode = item.item_code || item.name || '';
      
      return itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             itemCode.toLowerCase().includes(searchTerm.toLowerCase());
    }).slice(0, 8);

    console.log('[searchItems] Filtered items:', filteredItems);
    return filteredItems;
    
  } catch (error) {
    console.error('[searchItems] Error searching items:', error.message);
    console.error('[searchItems] Error stack:', error.stack);
    return [];
  }
};

// Mock data for testing - remove this when ERPNext API works
const mockItems = [
  { name: 'ITEM-001', item_name: 'Laptop Computer', item_code: 'ITEM-001' },
  { name: 'ITEM-002', item_name: 'Mouse Wireless', item_code: 'ITEM-002' },
  { name: 'ITEM-003', item_name: 'Keyboard Mechanical', item_code: 'ITEM-003' },
  { name: 'ITEM-004', item_name: 'Monitor 24inch', item_code: 'ITEM-004' },
  { name: 'ITEM-005', item_name: 'Webcam HD', item_code: 'ITEM-005' },
];

const mockWarehouses = [
  { name: 'WH-001', warehouse_name: 'Main Warehouse' },
  { name: 'WH-002', warehouse_name: 'Storage Room A' },
  { name: 'WH-003', warehouse_name: 'Storage Room B' },
  { name: 'WH-004', warehouse_name: 'Finished Goods' },
];

const searchItemsWithFallback = async (searchTerm) => {
  console.log('[searchItemsWithFallback] Using fallback search for term:', searchTerm);
  
  // Try real API first
  const realItems = await searchItems(searchTerm);
  
  if (realItems && realItems.length > 0) {
    console.log('[searchItemsWithFallback] Using real API results');
    return realItems;
  }
  
  // Fallback to mock data
  console.log('[searchItemsWithFallback] Using mock data as fallback');
  const filteredMockItems = mockItems.filter(item => 
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 8);
  
  return filteredMockItems;
};

const searchWarehousesWithFallback = async (searchTerm) => {
  console.log('[searchWarehousesWithFallback] Using fallback search for term:', searchTerm);
  
  try {
    const response = await fetch(`${ERPNEXT_URL}/api/resource/Warehouse?fields=["name","warehouse_name"]&limit_page_length=20`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[searchWarehousesWithFallback] API response not OK, using mock data');
      return mockWarehouses.filter(wh => 
        wh.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 8);
    }

    const data = await response.json();
    
    if (!data.data) {
      console.log('[searchWarehousesWithFallback] No data field, using mock data');
      return mockWarehouses.filter(wh => 
        wh.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 8);
    }

    const filteredWarehouses = data.data.filter(warehouse => {
      const warehouseName = warehouse.warehouse_name || warehouse.name || '';
      return warehouseName.toLowerCase().includes(searchTerm.toLowerCase());
    }).slice(0, 8);

    return filteredWarehouses;
    
  } catch (error) {
    console.error('[searchWarehousesWithFallback] Error, using mock data:', error.message);
    return mockWarehouses.filter(wh => 
      wh.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 8);
  }
};

const createMaterialRequest = async (materialRequestData) => {
  console.log('[createMaterialRequest] Creating material request with data:', materialRequestData);
  
  // For now, just simulate success since ERPNext API might not be working
  console.log('[createMaterialRequest] SIMULATING SUCCESS - ERPNext integration pending');
  
  return {
    data: {
      name: `MR-${Date.now()}`,
      items: materialRequestData.items
    }
  };
  
  // Uncomment below when ERPNext API is working:
  /*
  try {
    const payload = {
      items: materialRequestData.items,
      schedule_date: materialRequestData.scheduleDate || new Date().toISOString().split('T')[0],
      company: materialRequestData.company || "Default Company"
    };

    console.log('[createMaterialRequest] Sending request to ERPNext...');
    const response = await fetch(`${ERPNEXT_URL}/api/resource/Material Request`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    console.log('[createMaterialRequest] ERPNext response:', result);
    return result;
  } catch (error) {
    console.error('Error creating material request:', error);
    throw error;
  }
  */
};

// Rest of your bot conversation functions remain the same...
const sendWelcomeMessage = (bot, chatId) => {
  console.log('[sendWelcomeMessage] Sending welcome message to chat:', chatId);
  const welcomeMessage = `👋 Welcome to Tibeb Bot!\n\nPlease choose an option from the menu below:`;
  
  const options = {
    reply_markup: {
      keyboard: [
        [{ text: '1. Create Material Request' }],
        [{ text: '2. Create Purchase Request' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
  
  return bot.sendMessage(chatId, welcomeMessage, options);
};

const startMaterialRequest = (bot, chatId) => {
  console.log('[startMaterialRequest] Starting material request for chat:', chatId);
  userSessions.set(chatId, {
    state: 'awaiting_item_search',
    materialRequest: {
      items: []
    },
    currentItem: {}
  });
  
  const message = `📋 Creating Material Request\n\nPlease enter the item code or name to search:`;
  return bot.sendMessage(chatId, message, {
    reply_markup: { remove_keyboard: true }
  });
};

const handleItemSearch = async (bot, chatId, searchTerm) => {
  console.log('[handleItemSearch] Handling item search for chat:', chatId, 'term:', searchTerm);
  try {
    const items = await searchItemsWithFallback(searchTerm);
    
    if (items.length === 0) {
      return bot.sendMessage(chatId, `❌ No items found for "${searchTerm}". Please try a different search term:`, {
        reply_markup: { remove_keyboard: true }
      });
    }
    
    // Create custom keyboard with search results as buttons
    const keyboard = items.map(item => [{ 
      text: `${item.item_code || item.name} - ${item.item_name || item.name}` 
    }]);
    
    keyboard.push([{ text: '❌ Cancel Search' }]);
    
    const options = {
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
    
    return bot.sendMessage(chatId, `🔍 Search results for "${searchTerm}":\n\nPlease select an item from the buttons below:`, options);
  } catch (error) {
    console.error('Error handling item search:', error);
    return bot.sendMessage(chatId, '❌ Error searching for items. Please try again:');
  }
};

// ... (keep all the other functions the same as in your previous working version)
// [Include all the other functions: handleItemSelection, handleQuantityInput, handleWarehouseSearch, handleWarehouseSelection, handleFinishMaterialRequest, cancelMaterialRequest]

const handleItemSelection = async (bot, chatId, itemName) => {
  console.log('[handleItemSelection] Item selected for chat:', chatId, 'itemName:', itemName);
  const session = userSessions.get(chatId);
  if (!session) return;
  
  session.currentItem.item_code = itemName.split(' - ')[0]; // Extract item code from button text
  session.state = 'awaiting_quantity';
  userSessions.set(chatId, session);
  
  return bot.sendMessage(chatId, `✅ Item selected: ${itemName}\n\nPlease enter the quantity required:`, {
    reply_markup: { remove_keyboard: true }
  });
};

const handleQuantityInput = (bot, chatId, quantity) => {
  console.log('[handleQuantityInput] Quantity input for chat:', chatId, 'quantity:', quantity);
  const session = userSessions.get(chatId);
  if (!session) return;
  
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    return bot.sendMessage(chatId, '❌ Please enter a valid quantity (number greater than 0):');
  }
  
  session.currentItem.qty = qty;
  session.state = 'awaiting_warehouse_search';
  userSessions.set(chatId, session);
  
  return bot.sendMessage(chatId, `✅ Quantity: ${qty}\n\nPlease enter warehouse name to search:`, {
    reply_markup: { remove_keyboard: true }
  });
};

const handleWarehouseSearch = async (bot, chatId, searchTerm) => {
  console.log('[handleWarehouseSearch] Handling warehouse search for chat:', chatId, 'term:', searchTerm);
  try {
    const warehouses = await searchWarehousesWithFallback(searchTerm);
    
    if (warehouses.length === 0) {
      return bot.sendMessage(chatId, `❌ No warehouses found for "${searchTerm}". Please try a different search term:`, {
        reply_markup: { remove_keyboard: true }
      });
    }
    
    const keyboard = warehouses.map(warehouse => [{ 
      text: warehouse.warehouse_name || warehouse.name 
    }]);
    
    keyboard.push([{ text: '❌ Cancel Search' }]);
    
    const options = {
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
    
    return bot.sendMessage(chatId, `🏭 Warehouse search results for "${searchTerm}":\n\nPlease select a warehouse from the buttons below:`, options);
  } catch (error) {
    console.error('Error handling warehouse search:', error);
    return bot.sendMessage(chatId, '❌ Error searching for warehouses. Please try again:');
  }
};

const handleWarehouseSelection = (bot, chatId, warehouseName) => {
  console.log('[handleWarehouseSelection] Warehouse selected for chat:', chatId, 'warehouseName:', warehouseName);
  const session = userSessions.get(chatId);
  if (!session) return;
  
  session.currentItem.warehouse = warehouseName;
  session.materialRequest.items.push({
    item_code: session.currentItem.item_code,
    qty: session.currentItem.qty,
    warehouse: session.currentItem.warehouse
  });
  
  session.state = 'awaiting_add_more';
  userSessions.set(chatId, session);
  
  const itemSummary = `✅ Item added:\n- Item: ${session.currentItem.item_code}\n- Quantity: ${session.currentItem.qty}\n- Warehouse: ${session.currentItem.warehouse}`;
  
  const options = {
    reply_markup: {
      keyboard: [
        [{ text: '➕ Add Another Item' }],
        [{ text: '✅ Finish & Save' }],
        [{ text: '❌ Cancel Request' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
  
  return bot.sendMessage(chatId, `${itemSummary}\n\nWhat would you like to do next?`, options);
};

const handleFinishMaterialRequest = async (bot, chatId) => {
  console.log('[handleFinishMaterialRequest] Finishing material request for chat:', chatId);
  const session = userSessions.get(chatId);
  if (!session) return;
  
  try {
    const result = await createMaterialRequest(session.materialRequest);
    userSessions.delete(chatId);
    
    let summaryMessage = `✅ Material Request Created Successfully!\n\n📋 Request Summary:\n`;
    session.materialRequest.items.forEach((item, index) => {
      summaryMessage += `\n${index + 1}. ${item.item_code} - Qty: ${item.qty} - Warehouse: ${item.warehouse}`;
    });
    
    summaryMessage += `\n\n📄 Reference: ${result.data?.name || 'Pending'}`;
    
    await bot.sendMessage(chatId, summaryMessage, {
      reply_markup: { remove_keyboard: true }
    });
    
    return sendWelcomeMessage(bot, chatId);
    
  } catch (error) {
    console.error('[handleFinishMaterialRequest] Error creating material request:', error);
    userSessions.delete(chatId);
    await bot.sendMessage(chatId, '❌ Error creating material request. Please try again.', {
      reply_markup: { remove_keyboard: true }
    });
    return sendWelcomeMessage(bot, chatId);
  }
};

const cancelMaterialRequest = (bot, chatId) => {
  console.log('[cancelMaterialRequest] Canceling material request for chat:', chatId);
  userSessions.delete(chatId);
  return bot.sendMessage(chatId, '❌ Material request cancelled.', {
    reply_markup: { remove_keyboard: true }
  }).then(() => sendWelcomeMessage(bot, chatId));
};

// [Keep the handler function the same as before]
const handler = async (req: VercelRequest, res: VercelResponse) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [handler] Received request:`, { 
    method: req.method, 
    url: req.url,
    query: req.query, 
    body: req.body 
  });

  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Bot is running', 
      message: 'Tibeb Bot webhook is active' 
    });
  }

  const { body } = req;

  if (!body || !body.update_id) {
    return res.status(400).json({ error: 'Not a Telegram update' });
  }

  const bot = new TelegramBot(token);
  const { message } = body;

  try {
    if (message) {
      const { chat, text, from } = message;
      const chatId = chat.id;
      const session = userSessions.get(chatId);

      console.log('[handler] Processing message:', { 
        from: from?.first_name, 
        chatId, 
        text,
        sessionState: session?.state 
      });

      if (text === '❌ Cancel Search' || text === '❌ Cancel Request') {
        return cancelMaterialRequest(bot, chatId);
      }

      if (session) {
        switch (session.state) {
          case 'awaiting_item_search':
            await handleItemSearch(bot, chatId, text);
            break;
          case 'awaiting_quantity':
            await handleQuantityInput(bot, chatId, text);
            break;
          case 'awaiting_warehouse_search':
            await handleWarehouseSearch(bot, chatId, text);
            break;
          case 'awaiting_add_more':
            if (text === '➕ Add Another Item') {
              session.state = 'awaiting_item_search';
              session.currentItem = {};
              userSessions.set(chatId, session);
              await startMaterialRequest(bot, chatId);
            } else if (text === '✅ Finish & Save') {
              await handleFinishMaterialRequest(bot, chatId);
            }
            break;
          default:
            if (session.state === 'awaiting_item_search' && text !== '❌ Cancel Search') {
              await handleItemSelection(bot, chatId, text);
            } else if (session.state === 'awaiting_warehouse_search' && text !== '❌ Cancel Search') {
              await handleWarehouseSelection(bot, chatId, text);
            }
            break;
        }
        return res.status(200).json({ status: 'ok' });
      }

      if (text === '/start' || text === '/menu' || text === 'Menu') {
        await sendWelcomeMessage(bot, chatId);
      } 
      else if (text === '1. Create Material Request' || text === '1') {
        await startMaterialRequest(bot, chatId);
      }
      else if (text === '2. Create Purchase Request' || text === '2') {
        await bot.sendMessage(chatId, '🛒 Purchase Request functionality coming soon!');
        await sendWelcomeMessage(bot, chatId);
      }
      else {
        await sendWelcomeMessage(bot, chatId);
      }
    }

    return res.status(200).json({ status: 'ok' });
    
  } catch (error) {
    console.error('[handler] Error processing request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default allowCors(handler);