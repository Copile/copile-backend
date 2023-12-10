const axios = require("axios");

const WHOP_TOKEN = process.env.whopToken; // Ensure this environment variable is set

const fetchItemsForPage = async (url) => {
  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${WHOP_TOKEN}`,
    },
  });
  return data;
};

const fetchAllItems = async (endpoint, itemId, totalPages) => {
  let allItems = [];
  for (let page = 1; page <= totalPages; page++) {
    const url = `https://api.whop.com/api/v5/${endpoint}?page=${page}&${itemId.type}_id=${itemId.value}`;
    const pageData = await fetchItemsForPage(url);
    allItems = allItems.concat(pageData.data);
  }
  return allItems;
};

module.exports = { fetchItemsForPage, fetchAllItems };
