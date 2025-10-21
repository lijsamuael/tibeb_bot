import { userSessions } from "./handlers";

// Timeout utility for safe operations
const withTimeout = (promise, timeoutMs) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
};

/**
 * Safe message sender with timeout handling
 */
const sendMessageSafely = async (bot, chatId, message, options = {}) => {
  try {
    return await withTimeout(
      bot.sendMessage(chatId, message, options),
      8000 // 8 second timeout
    );
  } catch (error) {
    console.error('Failed to send message to chat', chatId, ':', error.message);
    // Don't throw error to prevent breaking the flow
    return null;
  }
};

/**
 * FLOW: Start Issue Creation Process
 */
export const startIssueCreation = async (bot, chatId, userInfo) => {
  console.log('[startIssueCreation] Starting issue creation for chat:', chatId);

  userSessions.set(chatId, {
    state: 'awaiting_issue_subject',
    requestData: {
      subject: '',
      issue_type: '',
      device_type: '',
      description: '',
      image_attachment: '',
      requested_by: userInfo?.full_name || userInfo?.username,
      userid: userInfo?.userid
    },
    currentStep: 0,
    userInfo: userInfo
  });

  const message = `🐛 *Maintenance Request Process Started*\n\nPlease provide the following information:\n\n📝 *Step 1: Subject*\nWhat is the main subject/title of your maintenance request?`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };

  await sendMessageSafely(bot, chatId, message, options);
};

/**
 * FLOW: Handle Issue Subject Input
 */
export const handleIssueSubject = async (bot, chatId, subject) => {
  console.log('[handleIssueSubject] Handling subject:', subject);
  
  const session = userSessions.get(chatId);
  if (!session) {
    await sendMessageSafely(bot, chatId, '❌ Session expired. Please start over.');
    return;
  }

  session.requestData.subject = subject;
  session.state = 'awaiting_issue_type';
  session.currentStep = 1;
  userSessions.set(chatId, session);

  const message = `✅ *Subject saved:* ${subject}\n\n🔧 *Step 2: Issue Type*\nSelect the type of issue:`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💻 Software Issue', callback_data: 'issue_type_software' },
          { text: '🖥️ Hardware Issue', callback_data: 'issue_type_hardware' }
        ],
        [
          { text: '⚡ Performance Issue', callback_data: 'issue_type_performance' },
          { text: '🌬️ Fan Issue', callback_data: 'issue_type_fan' }
        ],
        [
          { text: '🟦 Blue Screen Issue', callback_data: 'issue_type_bluescreen' }
        ],
        [{ text: '⬅️ BACK', callback_data: 'back_to_issue_subject' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };

  await sendMessageSafely(bot, chatId, message, options);
};

/**
 * FLOW: Handle Issue Type Selection
 */
export const handleIssueType = async (bot, chatId, issueType) => {
  console.log('[handleIssueType] Handling issue type:', issueType);
  
  const session = userSessions.get(chatId);
  if (!session) {
    await sendMessageSafely(bot, chatId, '❌ Session expired. Please start over.');
    return;
  }

  // Map callback data to display names
  const issueTypeMap = {
    'issue_type_software': 'Software Issue',
    'issue_type_hardware': 'Hardware Issue',
    'issue_type_performance': 'Performance Issue',
    'issue_type_fan': 'Fan Issue',
    'issue_type_bluescreen': 'Blue Screen Issue'
  };

  session.requestData.issue_type = issueTypeMap[issueType] || issueType;
  session.state = 'awaiting_device_type';
  session.currentStep = 2;
  userSessions.set(chatId, session);

  const message = `✅ *Issue Type saved:* ${session.requestData.issue_type}\n\n💻 *Step 3: Device Type*\nSelect the device type:`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💻 Laptop', callback_data: 'device_type_laptop' },
          { text: '🖥️ Desktop', callback_data: 'device_type_desktop' }
        ],
        [
          { text: '🖨️ Printer', callback_data: 'device_type_printer' }
        ],
        [{ text: '⬅️ BACK', callback_data: 'back_to_issue_type' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };

  await sendMessageSafely(bot, chatId, message, options);
};

/**
 * FLOW: Handle Device Type Selection
 */
export const handleDeviceType = async (bot, chatId, deviceType) => {
  console.log('[handleDeviceType] Handling device type:', deviceType);
  
  const session = userSessions.get(chatId);
  if (!session) {
    await sendMessageSafely(bot, chatId, '❌ Session expired. Please start over.');
    return;
  }

  // Map callback data to display names
  const deviceTypeMap = {
    'device_type_laptop': 'Laptop',
    'device_type_desktop': 'Desktop',
    'device_type_printer': 'Printer'
  };

  session.requestData.device_type = deviceTypeMap[deviceType] || deviceType;
  session.state = 'awaiting_image_attachment';
  session.currentStep = 3;
  userSessions.set(chatId, session);

  const message = `✅ *Device Type saved:* ${session.requestData.device_type}\n\n📷 *Step 4: Attach Image*\nPlease attach an image of the issue (optional):\n\n*Note:* You can send a photo or type "skip" to continue without image.`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⏭️ SKIP IMAGE', callback_data: 'skip_image_attachment' }],
        [{ text: '⬅️ BACK', callback_data: 'back_to_device_type' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };

  await sendMessageSafely(bot, chatId, message, options);
};

/**
 * FLOW: Handle Image Attachment
 */
export const handleImageAttachment = async (bot, chatId, photo) => {
  console.log('[handleImageAttachment] Handling image attachment');
  
  const session = userSessions.get(chatId);
  if (!session) {
    await sendMessageSafely(bot, chatId, '❌ Session expired. Please start over.');
    return;
  }

  if (photo && photo.length > 0) {
    // Get the largest photo size
    const largestPhoto = photo.reduce((prev, current) => 
      (prev.file_size > current.file_size) ? prev : current
    );
    
    session.requestData.image_attachment = largestPhoto.file_id;
    session.state = 'awaiting_description';
    session.currentStep = 4;
    userSessions.set(chatId, session);

    const message = `✅ *Image attached successfully!*\n\n📋 *Step 5: Description*\nPlease provide a detailed description of the issue:`;

    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ BACK', callback_data: 'back_to_image_attachment' }],
          [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
        ]
      }
    };

    await sendMessageSafely(bot, chatId, message, options);
  }
};

/**
 * FLOW: Skip Image Attachment
 */
export const skipImageAttachment = async (bot, chatId) => {
  console.log('[skipImageAttachment] Skipping image attachment');
  
  const session = userSessions.get(chatId);
  if (!session) {
    await sendMessageSafely(bot, chatId, '❌ Session expired. Please start over.');
    return;
  }

  session.requestData.image_attachment = '';
  session.state = 'awaiting_description';
  session.currentStep = 4;
  userSessions.set(chatId, session);

  const message = `⏭️ *Image attachment skipped*\n\n📋 *Step 5: Description*\nPlease provide a detailed description of the issue:`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅️ BACK', callback_data: 'back_to_image_attachment' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };

  await sendMessageSafely(bot, chatId, message, options);
};

/**
 * FLOW: Handle Description Input
 */
export const handleIssueDescription = async (bot, chatId, description) => {
  console.log('[handleIssueDescription] Handling description');
  
  const session = userSessions.get(chatId);
  if (!session) {
    await sendMessageSafely(bot, chatId, '❌ Session expired. Please start over.');
    return;
  }

  session.requestData.description = description;
  session.state = 'awaiting_confirmation';
  session.currentStep = 5;
  userSessions.set(chatId, session);

  await showIssueConfirmation(bot, chatId);
};

/**
 * FLOW: Show Issue Confirmation
 */
export const showIssueConfirmation = async (bot, chatId) => {
  console.log('[showIssueConfirmation] Showing confirmation for chat:', chatId);
  
  const session = userSessions.get(chatId);
  if (!session) {
    await sendMessageSafely(bot, chatId, '❌ Session expired. Please start over.');
    return;
  }

  const { subject, issue_type, device_type, description, image_attachment, requested_by } = session.requestData;

  let message = `📋 *Maintenance Request Summary*\n\n` +
    `*Subject:* ${subject}\n` +
    `*Issue Type:* ${issue_type}\n` +
    `*Device Type:* ${device_type}\n` +
    `*Description:* ${description}\n` +
    `*Image Attached:* ${image_attachment ? '✅ Yes' : '❌ No'}\n` +
    `*Requested By:* ${requested_by}\n\n` +
    `Please confirm to create this maintenance request:`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ CONFIRM CREATE', callback_data: 'confirm_issue_creation' },
          { text: '✏️ EDIT', callback_data: 'edit_issue_details' }
        ],
        [{ text: '⬅️ BACK', callback_data: 'back_to_description' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };

  await sendMessageSafely(bot, chatId, message, options);
};

/**
 * FLOW: Create Issue in ERPNext
 */
export const createIssueInERPNext = async (bot, chatId) => {
  console.log('[createIssueInERPNext] Creating issue for chat:', chatId);
  
  const session = userSessions.get(chatId);
  if (!session) {
    await sendMessageSafely(bot, chatId, '❌ Session expired. Please start over.');
    return;
  }

  try {
    // Show creating message immediately
    await sendMessageSafely(bot, chatId, '⏳ Creating maintenance request in ERPNext...');

    // Create Issue document in ERPNext
    const issueData = {
      doctype: 'Issue',
      subject: session.requestData.subject,
      issue_type: session.requestData.issue_type,
      device_type: session.requestData.device_type, // Using custom field
      description: session.requestData.description,
      // Add image attachment if available
      ...(session.requestData.image_attachment && {
        image_attachment: session.requestData.image_attachment
      })
    };

    // Use your existing createMaterialRequest pattern or create a new function
    const result = await createIssue(issueData);

    // Clear the session
    userSessions.delete(chatId);

    const successMessage = `✅ *Maintenance Request Created Successfully!*\n\n` +
      `📋 *Request Details:*\n` +
      `• Subject: ${session.requestData.subject}\n` +
      `• Issue Type: ${session.requestData.issue_type}\n` +
      `• Device Type: ${session.requestData.device_type}\n` +
      `• Request ID: ${result.name || result.data?.name}\n\n` +
      `Your maintenance request has been logged and will be addressed by the IT team.`;

    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🐛 CREATE ANOTHER REQUEST', callback_data: 'issue_request' }],
          [{ text: '🏠 MAIN MENU', callback_data: 'back_to_main' }]
        ]
      }
    };

    await sendMessageSafely(bot, chatId, successMessage, options);

  } catch (error) {
    console.error('[createIssueInERPNext] Error:', error);
    userSessions.delete(chatId);
    
    const errorMessage = `❌ *Failed to create maintenance request*\n\nError: ${error.message}\n\nPlease try again or contact IT support.`;
    
    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 TRY AGAIN', callback_data: 'issue_request' }],
          [{ text: '🏠 MAIN MENU', callback_data: 'back_to_main' }]
        ]
      }
    };
    
    await sendMessageSafely(bot, chatId, errorMessage, options);
  }
};

/**
 * FLOW: Show Edit Options for Issue
 */
export const showIssueEditOptions = async (bot, chatId) => {
  console.log('[showIssueEditOptions] Showing edit options for chat:', chatId);
  
  const session = userSessions.get(chatId);
  if (!session) {
    await sendMessageSafely(bot, chatId, '❌ Session expired. Please start over.');
    return;
  }

  const message = `✏️ *Edit Maintenance Request*\n\nWhich field would you like to edit?`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📝 Subject', callback_data: 'edit_issue_subject' },
          { text: '🔧 Issue Type', callback_data: 'edit_issue_type' }
        ],
        [
          { text: '💻 Device Type', callback_data: 'edit_device_type' },
          { text: '📋 Description', callback_data: 'edit_issue_description' }
        ],
        [
          { text: '📷 Image', callback_data: 'edit_image_attachment' }
        ],
        [{ text: '⬅️ BACK TO SUMMARY', callback_data: 'back_to_issue_confirmation' }],
        [{ text: '❌ CANCEL', callback_data: 'cancel_process' }]
      ]
    }
  };

  await sendMessageSafely(bot, chatId, message, options);
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Create Issue in ERPNext with timeout handling
 */
async function createIssue(issueData) {
  try {
    const response = await withTimeout(
      fetch(`${process.env.ERPNEXT_URL}/api/resource/Issue`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          data: {
            ...issueData,
            // Add user and user_id fields as requested
            user: issueData.raised_by, // Use the full name as user
            user_id: issueData.userid || issueData.raised_by // Use userid or fallback to full name
          }
        })
      }),
      15000 // 15 second timeout for ERPNext API
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating issue:', error);
    throw error;
  }
}

/**
 * Get current issue creation progress
 */
export const getIssueCreationProgress = (chatId) => {
  const session = userSessions.get(chatId);
  if (!session) return null;
  
  return {
    currentStep: session.currentStep,
    totalSteps: 5,
    currentState: session.state,
    data: session.requestData
  };
};