import type { VercelRequest, VercelResponse } from '@vercel/node'
import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'

dotenv.config()

const token = process.env.BOT_TOKEN

// Initialize the bot
const bot = new TelegramBot(token, { polling: false })

const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  return await fn(req, res)
}

// Function to send welcome message with buttons
const sendWelcomeMessage = (chatId) => {
  const welcomeMessage = `👋 Welcome to the Procurement Bot!\n\nPlease choose an option from the menu below:`
  
  const options = {
    reply_markup: {
      keyboard: [
        ['1. Create Material Request'],
        ['2. Create Purchase Request']
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  }
  
  bot.sendMessage(chatId, welcomeMessage, options)
}

// Function to handle material request
const handleMaterialRequest = (chatId) => {
  const message = `📋 Material Request Form\n\nPlease provide the following details:\n- Item Name\n- Quantity\n- Required Date\n- Department\n\nPlease type your response in the format:\nMaterial: [Item Name], Quantity: [Number], Date: [YYYY-MM-DD], Department: [Department Name]`
  
  bot.sendMessage(chatId, message)
}

// Function to handle purchase request
const handlePurchaseRequest = (chatId) => {
  const message = `🛒 Purchase Request Form\n\nPlease provide the following details:\n- Item Description\n- Quantity\n- Estimated Cost\n- Vendor (if known)\n- Justification\n\nPlease type your response in the format:\nPurchase: [Item Description], Quantity: [Number], Cost: [Amount], Vendor: [Vendor Name], Reason: [Justification]`
  
  bot.sendMessage(chatId, message)
}

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const { body } = req
  
  try {
    // Handle incoming updates from Telegram
    if (body && body.message) {
      const { chat, text, from } = body.message
      const chatId = chat.id
      
      console.log('Received message:', text, 'from:', from.first_name, 'chatId:', chatId)
      
      // Handle different commands and messages
      if (text === '/start' || text === '/menu') {
        sendWelcomeMessage(chatId)
      } 
      else if (text === '1. Create Material Request' || text === '1') {
        handleMaterialRequest(chatId)
      }
      else if (text === '2. Create Purchase Request' || text === '2') {
        handlePurchaseRequest(chatId)
      }
      else if (text.startsWith('Material:')) {
        // Process material request data
        const confirmationMessage = `✅ Material Request Received!\n\n${text}\n\nYour request has been submitted and is being processed. You will receive a confirmation shortly.`
        bot.sendMessage(chatId, confirmationMessage)
        
        // Send menu again
        sendWelcomeMessage(chatId)
      }
      else if (text.startsWith('Purchase:')) {
        // Process purchase request data
        const confirmationMessage = `✅ Purchase Request Received!\n\n${text}\n\nYour request has been submitted for approval. You will be notified once it's processed.`
        bot.sendMessage(chatId, confirmationMessage)
        
        // Send menu again
        sendWelcomeMessage(chatId)
      }
      else {
        // For any other message, show the welcome menu
        sendWelcomeMessage(chatId)
      }
    }
    
    res.status(200).json({ status: 'ok' })
  } catch (error) {
    console.error('Error handling request:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = allowCors(handler)