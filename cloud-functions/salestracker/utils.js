const axios = require("axios");

const WHOP_TOKEN = process.env.whopToken;

const fetchItemsForPage = async (url) => {
  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${WHOP_TOKEN}`,
    },
  });
  return data.data;
};

const fetchAllItems = async (endpoint, itemId, totalPages) => {
  let allItems = [];
  for (let page = 1; page <= totalPages; page++) {
    const url = `https://api.whop.com/api/v5/app/${endpoint}?page=${page}&${itemId.type}_id=${itemId.value}`;
    const items = await fetchItemsForPage(url);
    allItems = allItems.concat(items);
  }
  return allItems;
};

module.exports = { fetchItemsForPage, fetchAllItems };
