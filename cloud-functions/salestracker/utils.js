const axios = require("axios");

const WHOP_TOKEN = process.env.whopToken;

const fetchItemsForPage = async (url) => {
  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${WHOP_TOKEN}`,
    },
  });
  return data;
};

const fetchAllItems = async (endpoint, filterFunction, totalPages) => {
  let allItems = [];
  for (let page = 1; page <= totalPages; page++) {
    const url = `https://api.whop.com/api/v5/${endpoint}?page=${page}`;
    const pageData = await fetchItemsForPage(url);
    allItems = allItems.concat(pageData.data);
  }

  return allItems.filter(filterFunction);
};

module.exports = { fetchItemsForPage, fetchAllItems };
