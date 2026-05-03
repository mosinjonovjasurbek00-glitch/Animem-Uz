
export const getLocalData = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

export const saveLocalData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};
