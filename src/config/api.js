const API_BASE_URL = 'https://fairworks.vercel.app';

export const API = {
  login: `${API_BASE_URL}/api/login`,
  verifyUser: `${API_BASE_URL}/api/verifyUser`,
  fetchSheet: `${API_BASE_URL}/api/fetchSheet`,
  uploadPhoto: `${API_BASE_URL}/api/uploadPhoto`,
  uploads: `${API_BASE_URL}/api/uploads`,
  companiesList: `${API_BASE_URL}/api/companies/list`,
  forms: `${API_BASE_URL}/api/forms`,
  sites: `${API_BASE_URL}/api/sites`,
};

export default API;
