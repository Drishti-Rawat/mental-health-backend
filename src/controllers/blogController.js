import Blog from '../models/Blog.js';

/**
 * @desc    Get all blog posts with search, category, status filters & pagination
 * @route   GET /api/blogs
 * @access  Public / Admin
 */
export const getAllBlogs = async (req, res, next) => {
  try {
    const { search, category, status } = req.query;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const totalRecords = await Blog.countDocuments(query);
    const blogsDocs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    // Summary statistics for admin dashboard/blogs header
    const totalCount = await Blog.countDocuments({});
    const publishedCount = await Blog.countDocuments({ status: 'published' });
    const draftCount = await Blog.countDocuments({ status: 'draft' });

    const totalViewsResult = await Blog.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } },
    ]);
    const totalViews = totalViewsResult[0]?.totalViews || 0;

    res.status(200).json({
      success: true,
      count: blogsDocs.length,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats: {
        total: totalCount,
        published: publishedCount,
        drafts: draftCount,
        totalViews,
      },
      blogs: blogsDocs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single blog post details by ID or Slug & increment views
 * @route   GET /api/blogs/:idOrSlug
 * @access  Public
 */
export const getBlogByIdOrSlug = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;

    let blog = null;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      blog = await Blog.findById(idOrSlug);
    }

    if (!blog) {
      blog = await Blog.findOne({ slug: idOrSlug.toLowerCase() });
    }

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found',
      });
    }

    // Increment views count
    blog.views = (blog.views || 0) + 1;
    await blog.save();

    res.status(200).json({
      success: true,
      blog,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new blog post
 * @route   POST /api/blogs
 * @access  Private/Admin
 */
export const createBlog = async (req, res, next) => {
  try {
    const { title, summary, content, coverImage, author, category, tags, status, readTime } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and article content are required',
      });
    }

    let slug = Blog.createSlug(title);
    // Check if slug exists, append random suffix if collision
    const existingSlug = await Blog.findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const parsedTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
      ? tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const calculatedReadTime = Number(readTime) || Math.max(1, Math.ceil(content.split(/\s+/).length / 200));

    const blog = await Blog.create({
      title,
      slug,
      summary: summary || title.slice(0, 150),
      content,
      coverImage: coverImage || '/blog-placeholder.png',
      author: author || 'MentalCare Editorial Team',
      category: category || 'Mental Health',
      tags: parsedTags,
      status: status || 'published',
      readTime: calculatedReadTime,
    });

    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      blog,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an existing blog post
 * @route   PUT /api/blogs/:id
 * @access  Private/Admin
 */
export const updateBlog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found',
      });
    }

    const { title, summary, content, coverImage, author, category, tags, status, readTime } = req.body;

    if (title && title !== blog.title) {
      blog.title = title;
      let newSlug = Blog.createSlug(title);
      const slugExists = await Blog.findOne({ slug: newSlug, _id: { $ne: id } });
      if (slugExists) {
        newSlug = `${newSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      blog.slug = newSlug;
    }

    if (summary !== undefined) blog.summary = summary;
    if (content !== undefined) {
      blog.content = content;
      if (!readTime) {
        blog.readTime = Math.max(1, Math.ceil(content.split(/\s+/).length / 200));
      }
    }
    if (coverImage !== undefined) blog.coverImage = coverImage;
    if (author !== undefined) blog.author = author;
    if (category !== undefined) blog.category = category;
    if (status !== undefined) blog.status = status;
    if (readTime !== undefined) blog.readTime = Number(readTime) || blog.readTime;

    if (tags !== undefined) {
      blog.tags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    }

    await blog.save();

    res.status(200).json({
      success: true,
      message: 'Blog post updated successfully',
      blog,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a blog post
 * @route   DELETE /api/blogs/:id
 * @access  Private/Admin
 */
export const deleteBlog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Blog post deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
