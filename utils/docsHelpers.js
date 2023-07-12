const postLikes = require("../models/postLikes");
const commentLikes = require("../models/commentLikes");

function docIsLikedByUser(mongooseDocs, likedIds) {
  const updatedDocs = mongooseDocs.map((doc) => {
    return {
      ...doc,
      isLikedByUser: likedIds.includes(doc._id.toString()),
    };
  });
  return updatedDocs;
}

function docsIds(mongooseDocs) {
  return mongooseDocs.map((doc) => doc._id);
}

async function getPostsLikesIds(postsDocs, userId) {
  const postIds = docsIds(postsDocs);

  const foundLikes = await postLikes
    .find({
      post_id: { $in: postIds },
      user_id: userId,
    })
    .lean();
  return foundLikes.map((like) => like.post_id.toString());
}

async function getCommentLikesIds(postsDocs, userId) {
  const commentIds = docsIds(postsDocs);

  const foundLikes = await commentLikes
    .find({
      comment_id: { $in: commentIds },
      user_id: userId,
    })
    .lean();

  return foundLikes.map((like) => like.comment_id.toString());
}

module.exports = { docIsLikedByUser, getPostsLikesIds, getCommentLikesIds };
