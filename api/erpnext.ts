import * as dotenv from 'dotenv';

dotenv.config();

/**
 * [DEBUG] Get the schema for a Doctype to inspect fields
 */
export const getDoctypeSchema = async (doctype: string) => {
  console.log(`[getDoctypeSchema] START - Fetching schema for ${doctype}`);
  try {
    const url = `${process.env.ERPNEXT_URL}/api/resource/DocType/${doctype}`;
    console.log('[getDoctypeSchema] Making request to URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[getDoctypeSchema] END - Successfully fetched schema for ${doctype}`);
    return data.data;

  } catch (error) {
    console.error(`[getDoctypeSchema] ERROR - Could not fetch schema for ${doctype}:`, error.message);
    throw error;
  }
};

// ERPNext configuration
const ERPNEXT_URL = process.env.ERPNEXT_URL;
const ERPNEXT_API_KEY = process.env.ERPNEXT_API_KEY;
const ERPNEXT_API_SECRET = process.env.ERPNEXT_API_SECRET;

/**
 * Search items from ERPNext with UOM information
 */
export const searchItems = async (searchTerm = '') => {
  console.log('[searchItems] START - Searching items with term:', searchTerm);
  
  try {
    const url = `${ERPNEXT_URL}/api/resource/Item?fields=["name","item_name","item_code","disabled","stock_uom"]&limit_page_length=200`;
    
    console.log('[searchItems] Making request to URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[searchItems] Received response status:', response.status);
    
    if (!response.ok) {
      console.error('[searchItems] API response not OK:', response.status);
      throw new Error(`ERPNext API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[searchItems] Raw API response data received');
    
    if (!data.data) {
      console.log('[searchItems] No data field in response');
      return [];
    }

    console.log(`[searchItems] Total items in response: ${data.data.length}`);
    
    // Filter out disabled items
    const enabledItems = data.data.filter(item => item.disabled !== 1);
    console.log(`[searchItems] Enabled items after filtering: ${enabledItems.length}`);
    
    // If search term provided, filter items
    let filteredItems = enabledItems;
    if (searchTerm && searchTerm.trim() !== '') {
      const cleanSearchTerm = searchTerm.toLowerCase().trim();
      
      filteredItems = enabledItems.filter(item => {
        const itemName = (item.item_name || '').toLowerCase();
        const itemCode = (item.item_code || '').toLowerCase();
        
        return itemName.includes(cleanSearchTerm) ||
               itemCode.includes(cleanSearchTerm) ||
               cleanSearchTerm.includes(itemCode) ||
               cleanSearchTerm.includes(itemName);
      });
    }

    console.log(`[searchItems] Filtered items: ${filteredItems.length}`);
    
    // Sort by item name for better UX
    const sortedItems = filteredItems.sort((a, b) => {
      const nameA = (a.item_name || '').toLowerCase();
      const nameB = (b.item_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    console.log('[searchItems] END - Successfully completed search');
    return sortedItems;
    
  } catch (error) {
    console.error('[searchItems] ERROR - Error searching items:', error.message);
    throw error;
  }
};

/**
 * Search warehouses from ERPNext
 */
export const searchWarehouses = async (searchTerm = '') => {
  console.log('[searchWarehouses] START - Getting warehouses');

  try {
    const url = `${ERPNEXT_URL}/api/resource/Warehouse?fields=["name","warehouse_name"]&limit_page_length=100`;
    
    console.log('[searchWarehouses] Making request to URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[searchWarehouses] Received response status:', response.status);

    if (!response.ok) {
      console.error('[searchWarehouses] API response not OK');
      throw new Error(`ERPNext API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[searchWarehouses] Raw API response data received');

    if (!data.data) {
      console.log('[searchWarehouses] No data field in response');
      return [];
    }

    console.log(`[searchWarehouses] Total warehouses fetched: ${data.data.length}`);
    
    // Sort warehouses by name for better UX
    const sortedWarehouses = data.data.sort((a, b) => {
      const nameA = (a.warehouse_name || a.name || '').toLowerCase();
      const nameB = (b.warehouse_name || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    console.log('[searchWarehouses] END - Successfully completed search');
    return sortedWarehouses;

  } catch (error) {
    console.error('[searchWarehouses] ERROR - Error searching warehouses:', error.message);
    throw error;
  }
};

/**
 * Search users from ERPNext
 */
export const searchUsers = async (searchTerm: string) => {
  console.log('[searchUsers] START - Getting users with search term:', searchTerm);

  try {
    // Base URL with all the fields we need, including telegram_user_id
    const fields = '["name","full_name","username","email","enabled","telegram_user_id"]';
    let url = `${process.env.ERPNEXT_URL}/api/resource/User?fields=${fields}&limit_page_length=5000`;

    // Always filter for enabled users, and add search term filter if provided
    let filters = '[["enabled","=",1]]';
    if (searchTerm) {
      filters = `[["enabled","=",1],["full_name","like","%${encodeURIComponent(searchTerm)}%"]]`;
    }
    url += `&filters=${filters}`;
    
    console.log('[searchUsers] Making request to URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[searchUsers] Received response status:', response.status);

    if (!response.ok) {
      console.error('[searchUsers] API response not OK');
      throw new Error(`ERPNext API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[searchUsers] Raw API response data received');

    if (!data.data) {
      console.log('[searchUsers] No data field in response');
      return [];
    }

    console.log(`[searchUsers] Total users fetched: ${data.data.length}`);
    
    const sortedUsers = data.data.sort((a, b) => {
      const nameA = (a.full_name || a.name || '').toLowerCase();
      const nameB = (b.full_name || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    console.log('[searchUsers] END - Successfully completed search');
    return sortedUsers;

  } catch (error) {
    console.error('[searchUsers] ERROR - Error searching users:', error.message);
    throw error;
  }
};

/**
 * Create Material Request in ERPNext with user information
 */
export const createMaterialRequest = async (materialRequestData, userInfo) => {
  console.log('[createMaterialRequest] START - Creating material request with data:', materialRequestData);

  try {
    console.log('[createMaterialRequest] Step 1: Fetching company information');
    
    const companiesResponse = await fetch(`${ERPNEXT_URL}/api/resource/Company?fields=["name"]&limit_page_length=1`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    let companyName = 'Tibeb Technology Solutions';
    if (companiesResponse.ok) {
      const companiesData = await companiesResponse.json();
      if (companiesData.data && companiesData.data.length > 0) {
        companyName = companiesData.data[0].name;
      }
    }
    console.log('[createMaterialRequest] Using company:', companyName);

    // Determine material request type based on purpose
    let materialRequestType = 'Purchase';
    if (materialRequestData.purpose === 'Material Issue') {
      materialRequestType = 'Material Issue';
    } else if (materialRequestData.purpose === 'Material Transfer') {
      materialRequestType = 'Material Transfer';
    }

    console.log('[createMaterialRequest] Validating items before submission');
    for (const item of materialRequestData.items) {
      try {
        const itemCheck = await fetch(`${ERPNEXT_URL}/api/resource/Item/${item.item_code}?fields=["name","disabled"]`, {
          method: 'GET',
          headers: {
            'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (itemCheck.ok) {
          const itemData = await itemCheck.json();
          if (itemData.data.disabled === 1) {
            throw new Error(`Item ${item.item_code} is disabled`);
          }
        }
      } catch (itemError) {
        console.error(`[createMaterialRequest] Item validation failed for ${item.item_code}:`, itemError.message);
        throw itemError;
      }
    }

    const actualWarehouseName = materialRequestData.warehouse;

    const payload = {
      doctype: "Material Request",
      company: companyName,
      transaction_date: new Date().toISOString().split('T')[0],
      material_request_type: materialRequestType,
      schedule_date: materialRequestData.required_by || new Date().toISOString().split('T')[0],
      set_warehouse: actualWarehouseName,
      // Custom fields with user information
      my_warehouse: actualWarehouseName,
      requested_by: userInfo?.full_name || userInfo?.username || 'Telegram User',
      assign_to: materialRequestData.assign_to,
      userid: userInfo?.userid || 'telegram_user',
      work_item: "General Purchase",
      location: "Main Site",
      qty_of_work: materialRequestData.items.reduce((sum, item) => sum + item.qty, 0),
      items: materialRequestData.items.map(item => ({
        item_code: item.item_code,
        qty: item.qty,
        warehouse: actualWarehouseName,
        schedule_date: materialRequestData.required_by || new Date().toISOString().split('T')[0],
        uom: item.uom || "Nos",
        // Custom fields for each item
        work_item: item.work_item || item.item_code,
        location: item.location || "Main Site",
        qty_of_work: item.qty_of_work || item.qty.toString(),
        specification: "Standard Specification"
      }))
    };

    console.log('[createMaterialRequest] Step 2: Sending material request payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${ERPNEXT_URL}/api/resource/Material Request`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('[createMaterialRequest] Material request response status:', response.status);

    if (!response.ok) {
      let errorText = await response.text();
      console.error('[createMaterialRequest] API Error Response:', errorText);
      
      let userFriendlyError = 'Failed to create material request. Please contact administrator.';
      
      // Try to extract meaningful error from response
      try {
        if (errorText.includes('MandatoryError')) {
          userFriendlyError = 'Missing required fields. Please contact administrator.';
        } else if (errorText.includes('BrokenPipeError')) {
          userFriendlyError = 'System temporarily unavailable. Please try again in a moment.';
        }
      } catch (parseError) {
        console.error('[createMaterialRequest] Could not parse error response:', parseError);
      }
      
      console.log('[createMaterialRequest] END - Failed with API error');
      throw new Error(userFriendlyError);
    }

    const result = await response.json();
    console.log('[createMaterialRequest] Material request created successfully:', result);
    console.log('[createMaterialRequest] END - Successfully created material request');
    return result;

  } catch (error) {
    console.error('[createMaterialRequest] ERROR - Failed to create material request:', error);
    throw error;
  }
};

/**
 * Check stock balance for multiple items across all warehouses
 */
export const checkAllItemBalances = async (itemCodes: string[]) => {
  console.log('[checkAllItemBalances] START - Checking balances for items:', itemCodes);

  try {
    // This endpoint expects a JSON string array in the query parameter
    const encodedItems = encodeURIComponent(JSON.stringify(itemCodes));
    const url = `${ERPNEXT_URL}/api/method/erpnext.stock.utils.get_latest_stock_qty?item_code=${encodedItems}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[checkAllItemBalances] API Error:', errorText);
      throw new Error(`ERPNext API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[checkAllItemBalances] END - Successfully fetched balances');
    return data.message;

  } catch (error) {
    console.error('[checkAllItemBalances] ERROR - Error checking balances:', error.message);
    throw error;
  }
};

/**
 * Update the workflow state of a Material Request
 */
export const updateMaterialRequestStatus = async (requestId: string, status: string) => {
  console.log(`[updateMaterialRequestStatus] START - Updating ${requestId} to ${status}`);

  try {
    const url = `${ERPNEXT_URL}/api/resource/Material Request/${requestId}`;
    const payload = { workflow_state: status };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[updateMaterialRequestStatus] API Error:', errorText);
      throw new Error(`Failed to update status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[updateMaterialRequestStatus] END - Successfully updated ${requestId}`);
    return result;

  } catch (error) {
    console.error('[updateMaterialRequestStatus] ERROR:', error.message);
    throw error;
  }
};

/**
 * Find a user in ERPNext by their Telegram User ID
 */
export const findUserByTelegramId = async (telegramId: string) => {
  console.log('[findUserByTelegramId] START - Searching for user with Telegram ID:', telegramId);

  try {
    const url = `${ERPNEXT_URL}/api/resource/User?fields=["name","full_name","telegram_user_id"]&filters=[["telegram_user_id","=","${telegramId}"]]`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`ERPNext API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      console.log('[findUserByTelegramId] END - User found:', data.data[0].full_name);
      return data.data[0]; // Return the first user found
    }

    console.log('[findUserByTelegramId] END - User not found');
    return null;

  } catch (error) {
    console.error('[findUserByTelegramId] ERROR:', error.message);
    throw error;
  }
};

/**
 * Submit a Material Request document (changes docstatus from 0 to 1)
 */
export const submitMaterialRequest = async (requestId: string) => {
  console.log(`[submitMaterialRequest] START - Submitting ${requestId}`);

  try {
    const url = `${ERPNEXT_URL}/api/resource/Material Request/${requestId}`;
    const payload = { docstatus: 1 }; // Submit the document

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[submitMaterialRequest] API Error:', errorText);
      throw new Error(`Failed to submit document: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[submitMaterialRequest] END - Successfully submitted ${requestId}`);
    return result;

  } catch (error) {
    console.error('[submitMaterialRequest] ERROR:', error.message);
    throw error;
  }
};