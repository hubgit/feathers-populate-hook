'use strict'

module.exports = function populate (options) {
  /**
   * Example options:
   * messageService.after({
   *   find: [
   *     globalHooks.populate({
   *       user: { // Destination key
   *         service: 'users', // Foreign service
   *         f_key: 'id',  // Foreign key
   *         one: true // Optional, if only one resolve object is wanted
   *       },
   *       comments: { // Destination key
   *         service: 'comments', // Foreign service
   *         f_key: 'message',  // Foreign key
   *         l_key: 'id',  // Local key
   *        },
   *       resolvedCategories: { // Destination key
   *         service: 'categories', // Foreign service
   *         f_key: 'id',  // Foreign key
   *         l_key: 'categories' // Local key, optional, if different then destination key
   *       }
   *     })
   *   ]
   * })
   **/   

  return function(hook) {

    /** 
     * Block some populates from the client:
     * set query.$populate to {dontPopulateField: 0}; 
     * or 
     * set query.$populate to false to block all populates
     **/
    let skip = {};
    if (hook.params.query.$populate || hook.params.query.$populate===false) {
      if (hook.params.query.$populate.constructor === Object) {
        Object.keys(hook.params.query.$populate).map(function(key) {
          if (!hook.params.query.$populate[key]) {
            skip[key] = true;
          }
        });
      }
      let skipAll = hook.params.query.$populate===false;
      delete hook.params.query.$populate;
      if (skipAll) return hook;     
    }

   let populate = function(obj) {
      // If it's a mongoose model then
      if (typeof obj.toObject === 'function') {
        obj = obj.toObject(); 
      }
      // If it's a Sequelize model   
      else if (typeof obj.toJSON === 'function') {
        obj = obj.toJSON();
      }
      let populateField = function(key) {
        if (skip[key]) return;
        let option = options[key];
        let find = {
          query: option.query ? option.query : {}
        };
        let value = obj[option.l_key||key];
        if (Array.isArray(value)) value = {$in: value};
        find.query[option.f_key] = value;
        return hook.app.service(option.service).find(find).
          then(result => {
            let data = result.data;
            if (option.one) data = result.data[0];
            obj[key] = data;
            return;
          });
      };
      return Promise.all(Object.keys(options).map(populateField));
    };

    if (hook.result) {
      if (hook.method === 'find' || Array.isArray(hook.result.data)) {
        return Promise.all((hook.result.data || hook.result).map(populate))
          .then(() => {
            return hook;
          });
      } else {
        return populate(hook.result)
          .then(() => {
            return hook;
          });
      }
    } 
    return hook;
  };    
};  