const queryString = require('query-string');

const Movie = require('../models/Movie');

const getMatchObj = (query, lang) => {
  if (!query.name && !query.genre && !query.rating) return null;

  const matchObj = { $and: [] };

  if (query.name) {
    const regex = new RegExp(query.name, 'i');
    const $or = [
      { director: regex },
      { stars: regex },
    ];
    if (lang === 'fr') {
      $or.push({ 'title.fr': regex });
    } else {
      $or.push({ 'title.en': regex });
    }
    matchObj.$and.push({ $or });
  }
  if (query.genre) {
    if (lang === 'fr') {
      matchObj.$and.push({
        'genres.fr': query.genre,
      });
    } else {
      matchObj.$and.push({
        'genres.en': query.genre,
      });
    }
  }
  if (query.rating) {
    matchObj.$and.push({
      rating: { $gte: query.rating }
    });
  }
  if (query.sort === 'oldest') {
    matchObj.$and.push({
      year: { $ne: -1 }
    });
  }
  return matchObj;
};

const getSortObj = (sort, suggestionDefaultSort, lang) => {
  const sortObj = {};

  switch (sort) {
    case 'latest':
      sortObj.year = -1;
      break;

    case 'oldest':
      sortObj.year = 1;
      break;

    case 'rating':
      sortObj.rating = -1;
      break;

    case 'seeds':
      sortObj['torrents.seeds'] = -1;
      break;

    default:
      if (suggestionDefaultSort) {
        return { 'torrents.seeds': -1 };
      }
      break;
  }
  if (lang === 'fr') {
    sortObj['title.fr'] = 1;
  }
  sortObj['title.en'] = 1;

  return sortObj;
};

/**
 * GET /api/gallery/search
 * Search movies into database.
 */

exports.getSearch = async (req, res) => {
  const { query } = req;
  const { lang = 'en' } = query;

  const matchObj = getMatchObj(query, lang);

  const suggestionDefaultSort = !matchObj;
  const sortObj = getSortObj(query.sort, suggestionDefaultSort, lang);

  // define number of results per requests
  const toSkip = !query.start ? 0 : parseInt(query.start, 10);
  const numberPerRequest = 10;

  // get movies from db
  const cursor = Movie.find(
    matchObj,
    null,
    {
      sort: sortObj,
      skip: toSkip,
      limit: numberPerRequest,
    }
  );

  const movies = await cursor.exec();

  // format server response
  const resObj = { error: '', movies };
  if (movies.length === numberPerRequest) {
    query.start = toSkip + numberPerRequest;
    resObj.nextHref = `/api/gallery/search?${queryString.stringify(query)}`;
  }

  // send response and end request
  return res.send(resObj);
};
