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
  handleRequestSubmission,
  startPurchaseOrderProcess
} from './handlers';
import { findUserByTelegramId, getDoctypeSchema } from './erpnext';

dotenv.config();

// ==================== CONFIGURATION ====================
export const config = {
  maxDuration: 30, // seconds
};

// ==================== TOKEN VALIDATION ====================
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('[CONFIG] CRITICAL: BOT_TOKEN environment variable is missing');
  throw new Error('BOT_TOKEN environment variable is required');
}
console.log('[CONFIG] Bot token loaded successfully');

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
  console.log('[handler] START - Method:', req.method, 'URL:', req.url, 'Timestamp:', new Date().toISOString());

  // Log environment info (without sensitive data)
  console.log('[handler] Environment check - NODE_ENV:', process.env.NODE_ENV, 'BOT_TOKEN exists:', !!process.env.BOT_TOKEN);

  if (req.method === 'GET') {
    console.log('[handler] Health check requested');
    return res.status(200).json({
      status: 'Bot is running',
      message: 'Tibeb Design & Build Bot is active',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  }

  // Log request body (safely)
  console.log('[handler] Request body received:', {
    hasMessage: !!req.body?.message,
    hasCallbackQuery: !!req.body?.callback_query,
    messageFrom: req.body?.message?.from?.username || req.body?.message?.from?.id,
    callbackFrom: req.body?.callback_query?.from?.username || req.body?.callback_query?.from?.id,
    callbackData: req.body?.callback_query?.data
  });

  const { body } = req;
  const bot = new TelegramBot(token, { polling: false });

  try {
    if (body.message) {
      const { chat, text, from } = body.message;
      const chatId = chat.id;
      const session = userSessions.get(chatId);

      console.log('[handler] Processing message - Chat ID:', chatId, 'Text:', text, 'Session exists:', !!session);

      // Find user in ERPNext to get their full name
      const erpUser = await findUserByTelegramId(from.id.toString());
      console.log('[handler] ERP User lookup - Telegram ID:', from.id, 'Found:', !!erpUser);

      const userInfo = {
        username: from?.username,
        userid: from?.id?.toString(),
        full_name: erpUser?.full_name || `${from?.first_name || ''} ${from?.last_name || ''}`.trim() || from?.username
      };

      console.log('[handler] User info:', userInfo.full_name, 'Chat ID:', chatId, 'Text:', text);

      if (text === '/getschema') {
        console.log('[handler] DEBUG: Getting User doctype schema');
        const schema = await getDoctypeSchema('User');
        console.log('[handler] DEBUG: User Schema:', JSON.stringify(schema, null, 2));
        bot.sendMessage(chatId, 'Check the console logs for the User schema.');
        return res.status(200).json({ status: 'ok' });
      }

      if (text === '/start') {
        console.log('[handler] Starting new session for user:', userInfo.full_name);
        await showPurposeOptions(chatId, bot, userInfo);
        console.log('[handler] Start flow completed');
        return res.status(200).json({ status: 'ok' });
      }

      if (session) {
        console.log('[handler] Session state:', session.state);
        switch (session.state) {
          case 'awaiting_item_selection':
            console.log('[handler] Processing item selection with text:', text);
            await showItemSelectionList(bot, chatId, text);
            break;
          case 'awaiting_quantity':
            const qty = parseFloat(text);
            console.log('[handler] Processing quantity input:', text, 'Parsed:', qty);
            if (!isNaN(qty) && qty > 0) {
              session.currentItem.qty = qty;
              await showWorkItemInput(bot, chatId);
            } else {
              console.log('[handler] Invalid quantity input:', text);
              bot.sendMessage(chatId, 'Invalid quantity. Please enter a positive number.');
            }
            break;
          case 'awaiting_work_item':
            console.log('[handler] Processing work item input:', text);
            session.currentItem.work_item = text;
            await showLocationInput(bot, chatId);
            break;
          case 'awaiting_location':
            console.log('[handler] Processing location input:', text);
            session.currentItem.location = text;
            await showQtyOfWorkInput(bot, chatId);
            break;
          case 'awaiting_qty_of_work':
            console.log('[handler] Processing quantity of work input:', text);
            session.currentItem.qty_of_work = text;
            session.requestData.items.push(session.currentItem);
            session.currentItem = {};
            await showItemActionOptions(bot, chatId);
            break;
          case 'awaiting_user_search':
            console.log('[handler] Processing user search:', text);
            await showUserSelectionList(bot, chatId, text);
            break;
          case 'awaiting_approver_search':
            console.log('[handler] Processing approver search:', text);
            if (session.requestId) {
              await showApproverSelectionList(bot, chatId, session.requestId, text);
            } else {
              bot.sendMessage(chatId, '❌ Could not find the request ID. Please start over.');
            }
            break;
          default:
            console.log('[handler] Unknown session state:', session.state);
        }
      } else {
        console.log('[handler] No session found for chat ID:', chatId);
      }
    } else if (body.callback_query) {
      const { message, data, from } = body.callback_query;
      const chatId = message.chat.id;
      const session = userSessions.get(chatId);

      console.log('[handler] Processing callback - Chat ID:', chatId, 'Data:', data, 'Session exists:', !!session);

      // Find user in ERPNext to get their full name
      const erpUser = await findUserByTelegramId(from.id.toString());
      console.log('[handler] Callback ERP User lookup - Telegram ID:', from.id, 'Found:', !!erpUser);

      const userInfo = {
        username: from?.username,
        userid: from?.id?.toString(),
        full_name: erpUser?.full_name || `${from?.first_name || ''} ${from?.last_name || ''}`.trim() || from?.username
      };

      console.log('[handler] Callback from:', userInfo.full_name, 'Chat ID:', chatId, 'Data:', data);

      if (data.startsWith('item_page:')) {
        const [, page, searchTerm] = data.split(':');
        console.log('[handler] Handling item pagination - Page:', page, 'Search:', searchTerm);
        await showItemSelectionList(bot, chatId, searchTerm, parseInt(page, 10));
      } else if (data.startsWith('select_item:')) {
        const itemCode = data.split(':')[1];
        console.log('[handler] Handling item selection:', itemCode);
        const selectedItem = session?.availableItems?.find(item => item.item_code === itemCode);
        if (selectedItem) {
          await showQuantityInput(bot, chatId, itemCode, selectedItem.item_name, selectedItem.stock_uom);
        } else {
          console.log('[handler] Selected item not found in session:', itemCode);
        }
      } else if (data.startsWith('select_warehouse:')) {
        const warehouseName = data.split(':')[1];
        console.log('[handler] Handling warehouse selection:', warehouseName);
        await handleWarehouseSelection(bot, chatId, warehouseName);
      } else if (data.startsWith('select_user:')) {
        const userName = data.split(':')[1];
        console.log('[handler] Handling user selection:', userName);
        await handleUserSelection(bot, chatId, userName);
      } else if (data.startsWith('user_page:')) {
        const [, page, searchTerm] = data.split(':');
        console.log('[handler] Handling user pagination - Page:', page, 'Search:', searchTerm);
        await showUserSelectionList(bot, chatId, searchTerm, parseInt(page, 10));
      } else if (data.startsWith('check_balance:')) {
        const requestId = data.split(':')[1];
        console.log('[handler] Handling balance check for request:', requestId);
        await handleCheckBalance(bot, chatId, requestId);
      } else if (data.startsWith('checker_action:')) {
        const requestId = data.split(':')[1];
        console.log('[handler] Showing checker actions for request:', requestId);
        await showCheckerActionOptions(bot, chatId, requestId);
      } else if (data.startsWith('checker_confirm:')) {
        const requestId = data.split(':')[1];
        console.log('[handler] Handling checker confirmation for request:', requestId);
        await handleCheckerConfirm(bot, chatId, requestId);
      } else if (data.startsWith('checker_cancel:')) {
        const requestId = data.split(':')[1];
        console.log('[handler] Handling checker cancellation for request:', requestId);
        await handleCheckerCancel(bot, chatId, requestId);
      } else if (data.startsWith('approver_approve:')) {
        const requestId = data.split(':')[1];
        console.log('[handler] Handling approver approval for request:', requestId);
        await handleApproverApprove(bot, chatId, requestId);
      } else if (data.startsWith('approver_reject:')) {
        const requestId = data.split(':')[1];
        console.log('[handler] Handling approver rejection for request:', requestId);
        await handleApproverReject(bot, chatId, requestId);
      } else if (data.startsWith('select_approver:')) {
        const [, requestId, approverName] = data.split(':');
        console.log('[handler] Handling approver selection for request:', requestId, 'Approver:', approverName);
        await handleApproverSelection(bot, chatId, requestId, approverName);
      } else if (data.startsWith('approver_page:')) {
        const [, requestId, page, searchTerm] = data.split(':');
        console.log('[handler] Handling approver pagination - Request:', requestId, 'Page:', page, 'Search:', searchTerm);
        await showApproverSelectionList(bot, chatId, requestId, searchTerm, parseInt(page, 10));
      } else if (data.startsWith('submit_request:')) {
        const requestId = data.split(':')[1];
        console.log('[handler] Handling request submission:', requestId);
        await handleRequestSubmission(bot, chatId, requestId);
      } else {
        console.log('[handler] Handling general callback data:', data);
        switch (data) {
          case 'material_request':
            console.log('[handler] Starting material request flow');
            await showMaterialRequestOptions(chatId, bot);
            break;
          case 'material_issue':
            console.log('[handler] Starting material issue flow');
            await startMaterialIssue(bot, chatId, userInfo);
            break;
          case 'material_purchase':
            console.log('[handler] Starting material purchase flow');
            await startMaterialPurchase(bot, chatId, userInfo);
            break;
          case 'create_purchase_order':
            console.log('[handler] Starting purchase order flow');
            await startPurchaseOrderProcess(bot, chatId, userInfo);
            break;
          case 'search_items':
            console.log('[handler] Showing search prompt');
            await showSearchPrompt(bot, chatId);
            break;
          case 'show_all_items':
            console.log('[handler] Showing all items');
            await showItemSelectionList(bot, chatId, '');
            break;
          case 'back_to_item_options':
            console.log('[handler] Returning to item options');
            await startMaterialIssue(bot, chatId, userInfo);
            break;
          case 'back_to_items':
            console.log('[handler] Returning to items list');
            await showItemSelectionList(bot, chatId, session?.searchTerm, session?.currentPage);
            break;
          case 'back_to_quantity':
            console.log('[handler] Returning to quantity input');
            const lastItem = session?.currentItem;
            if (lastItem) {
              await showQuantityInput(bot, chatId, lastItem.item_code, lastItem.item_name, lastItem.uom);
            }
            break;
          case 'back_to_work_item':
            console.log('[handler] Returning to work item input');
            await showWorkItemInput(bot, chatId);
            break;
          case 'back_to_location':
            console.log('[handler] Returning to location input');
            await showLocationInput(bot, chatId);
            break;
          case 'add_another_item':
            console.log('[handler] Adding another item');
            await startMaterialIssue(bot, chatId, userInfo);
            break;
          case 'finish_items':
            console.log('[handler] Finishing items, showing warehouse selection');
            await showWarehouseSelection(bot, chatId);
            break;
          
            case 'search_users':
              await showUserSearchPrompt(bot, chatId);
              break;
  
          
          case 'back_to_item_action':
            console.log('[handler] Returning to item action options');
            await showItemActionOptions(bot, chatId);
            break;
          case 'back_to_warehouses':
            console.log('[handler] Returning to warehouse selection');
            await showWarehouseSelection(bot, chatId);
            break;
          case 'back_to_warehouse_selection':
            console.log('[handler] Returning to warehouse selection');
            await showWarehouseSelection(bot, chatId);
            break;
          case 'back_to_user_search':
            console.log('[handler] Returning to user search');
            await showUserSearchPrompt(bot, chatId);
            break;
          case 'back_to_approver_search':
            console.log('[handler] Returning to approver search');
            const requestId = data.split(':')[1];
            await showApproverSearchPrompt(bot, chatId, requestId);
            break;
          case 'cancel_process':
            console.log('[handler] Cancelling process for chat ID:', chatId);
            userSessions.delete(chatId);
            await showPurposeOptions(chatId, bot, userInfo);
            break;
          case 'back_to_main':
            console.log('[handler] Returning to main menu');
            await showPurposeOptions(chatId, bot, userInfo);
            break;
          case 'view_status':
            console.log('[handler] View status requested');
            bot.sendMessage(chatId, 'This feature is coming soon!');
            break;
          case 'help_support':
            console.log('[handler] Help/support requested');
            bot.sendMessage(chatId, 'For help, please contact our support team.');
            break;
          default:
            console.log('[handler] Unknown callback data:', data);
        }
      }
    } else {
      console.log('[handler] No message or callback_query in request body');
    }

    console.log('[handler] SUCCESS - Request processed successfully');
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[handler] ERROR:', error);
    console.error('[handler] Error stack:', error.stack);
    console.error('[handler] Request that caused error:', {
      method: req.method,
      url: req.url,
      body: {
        hasMessage: !!req.body?.message,
        hasCallbackQuery: !!req.body?.callback_query,
        messageFrom: req.body?.message?.from?.username || req.body?.message?.from?.id,
        callbackFrom: req.body?.callback_query?.from?.username || req.body?.callback_query?.from?.id
      }
    });
    
    return res.status(500).json({ 
      status: 'error', 
      message: 'Internal Server Error',
      error: error.message 
    });
  }
};

console.log('[INIT] Bot handler initialized successfully');
export default allowCors(handler);