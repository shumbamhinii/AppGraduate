const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');
const cron = require('node-cron');


// PostgreSQL pool setup
const pool = new Pool({
    connectionString: 'postgres://postgres:123qwe@localhost:5432/UoZ',
    ssl: false,
  })
// Data extractor for Jobzilla
const extractFromJobzilla = ($) => {
  const items = [];
  $('.job-listing').each((index, element) => {
    items.push({
      name: $(element).find('.job-title').text(),
      category: 'Job',
      mentor: null,
      company: $(element).find('.company-name').text(),
      description: $(element).find('.job-description').text(),
      download_link: $(element).find('a').attr('href')
    });
  });
  return items;
};

// Data extractor for MyJobMag
const extractFromMyJobMag = ($) => {
  const items = [];
  $('.job-item').each((index, element) => {
    items.push({
      name: $(element).find('.title').text(),
      category: 'Internship',
      mentor: null,
      company: $(element).find('.company').text(),
      description: $(element).find('.summary').text(),
      download_link: $(element).find('a').attr('href')
    });
  });
  return items;
};

// Data extractor for The Zimbabwean
const extractFromTheZimbabwean = ($) => {
  const items = [];
  $('.article').each((index, element) => {
    items.push({
      name: $(element).find('h2').text(),
      category: 'News',
      mentor: null,
      company: 'The Zimbabwean',
      description: $(element).find('p').text(),
      download_link: $(element).find('a').attr('href')
    });
  });
  return items;
};

// Placeholder function for LinkedIn
const extractFromLinkedIn = ($) => {
  // LinkedIn scraping would require advanced techniques and is subject to LinkedIn's terms of service.
  return [];
};

// Define the URLs and extraction functions
const sites = [
  {
    url: 'https://www.jobzilla.co.zw/',
    extractor: extractFromJobzilla
  },
  {
    url: 'https://www.zimbajob.com/',
    extractor: extractFromMyJobMag
  },
  {
    url: 'https://www.thezimbabwean.co/',
    extractor: extractFromTheZimbabwean
  },
  {
    url: 'https://www.linkedin.com/jobs/', // LinkedIn requires authentication and is not scrapped
    extractor: extractFromLinkedIn // Placeholder function for LinkedIn
  }
];

// Function to fetch data from a URL
const fetchFromUrl = async (url, dataExtractor) => {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      const items = dataExtractor($);
      return items;
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error.message);
      return [];
    }
  };
  
  // Function to store data in PostgreSQL
  const storeOpportunities = async (items) => {
    try {
      const query = `
        INSERT INTO academics.opportunities (name, category, mentor, company, description, download_link)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name, category) DO NOTHING
      `;
      for (const item of items) {
        await pool.query(query, [item.name, item.category, item.mentor, item.company, item.description, item.download_link]);
      }
      console.log('Opportunities stored successfully.');
    } catch (error) {
      console.error('Error storing opportunities:', error.message);
    }
  };
  
  // Function to fetch and store data
  const fetchAndStoreOpportunities = async () => {
    try {
      console.log('Starting fetch and store operations...');
      let allItems = [];
      for (const site of sites) {
        console.log(`Fetching from ${site.url}`);
        const items = await fetchFromUrl(site.url, site.extractor);
        allItems = allItems.concat(items);
      }
      console.log('Fetched all items. Storing in database...');
      await storeOpportunities(allItems);
    } catch (error) {
      console.error('Error in fetchAndStoreOpportunities:', error.message);
    }
  };
  
  // Schedule the task to run daily
  cron.schedule('0 0 * * *', fetchAndStoreOpportunities);
  
  // Run the task immediately for testing
  fetchAndStoreOpportunities();
