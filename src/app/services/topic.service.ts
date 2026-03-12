import {inject, Injectable, signal} from '@angular/core';
import {Topic, TopicStatus, TopicType, CreateTopicRequest} from '../models/Topic';
import {ApiService} from './api.service';
import {Post} from '../models/Post';
import {NotificationService} from './notification.service';
import {AuthService} from './auth.service';
import {Router} from '@angular/router';

interface PostsResponse {
  page: number;
  posts: Post[];
}

@Injectable({ providedIn: 'root' })
export class TopicService {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private router = inject(Router);

  private topicSignal = signal<Topic>({
    id: 0,
    name: '',
    subforum_id: 0,
    date_created: '',
    date_last_post: '',
    author_user_id: 0,
    author_username: '',
    post_number: 0,
    last_post_author_user_id: null,
    last_post_author_username: null,
    type: TopicType.general,
    status: TopicStatus.active,
    episode: null,
    character: null
  });
  readonly topic = this.topicSignal.asReadonly();

  private postsSignal = signal<Post[]>([]);
  readonly posts = this.postsSignal.asReadonly();

  private currentPageSignal = signal<number>(1);
  readonly currentPage = this.currentPageSignal.asReadonly();

  private readonly postsPerPage = 15;

  constructor() {
    this.notificationService.postCreated$.subscribe(event => {
      const currentTopicId = this.topic().id;
      if (event.data.topic_id == currentTopicId) {
        this.handleNewPost(event.data);
      }
    });

    this.notificationService.postUpdated$.subscribe(event => {
      const currentTopicId = this.topic().id;
      if (event.data.topic_id == currentTopicId) {
        this.updateLocalPost(event.data);
      }
    });
  }

  loadTopic(id: number) {
    this.apiService.get<Topic>('topic/get/' + id.toString()).subscribe(data => {
      const enrichedTopic = this.enrichTopicWithPermissions(data);
      this.topicSignal.set(enrichedTopic);
    });
  }

  loadPosts(topicId: number, page: number, postId?: number) {
    let url = `topic-posts/${topicId}?page=${page}`;
    if (postId) {
      url = `topic-posts/${topicId}?post_id=${postId}`;
    }

    this.apiService.get<PostsResponse>(url).subscribe(data => {
      const enrichedPosts = data.posts.map(post => this.enrichPostWithPermissions(post));
      this.postsSignal.set(enrichedPosts);
      this.currentPageSignal.set(data.page);
    });
  }

  createPost(data: any) {
    return this.apiService.post('post/create', data);
  }

  updatePost(id: number, data: any) {
    return this.apiService.post(`post/update/${id}`, data);
  }

  createTopic(data: CreateTopicRequest) {
    return this.apiService.post('topic/create', data);
  }

  updateTopic(id: number, data: any) {
    return this.apiService.post(`topic/update/${id}`, data);
  }

  updateLocalPost(updatedPost: Post) {
    const enrichedPost = this.enrichPostWithPermissions(updatedPost);
    this.postsSignal.update(posts => posts.map(p => p.id === enrichedPost.id ? enrichedPost : p));
  }

  updateLocalTopic(updatedTopic: Topic) {
    const enrichedTopic = this.enrichTopicWithPermissions(updatedTopic);
    this.topicSignal.set(enrichedTopic);
  }

  private handleNewPost(post: Post) {
    const enrichedPost = this.enrichPostWithPermissions(post);

    // Add the new post to the list
    this.postsSignal.update(posts => [...posts, enrichedPost]);

    // Increment the post count in the topic
    this.topicSignal.update(topic => {
      if (topic) {
        return { ...topic, post_number: topic.post_number + 1 };
      }
      return topic;
    });

    // Check if the current user is the author and redirect if so
    const currentUser = this.authService.currentUser();
    if (currentUser && enrichedPost.user_profile && currentUser.id === enrichedPost.user_profile.user_id) {
      const totalPosts = this.topic().post_number;
      const lastPage = Math.ceil(totalPosts / this.postsPerPage);
      this.router.navigate(['/viewtopic', this.topic().id], { queryParams: { page: lastPage } });
    }
  }

  private enrichPostWithPermissions(post: Post): Post {
    const currentUser = this.authService.currentUser();
    if (currentUser && post.user_profile && currentUser.id === post.user_profile.user_id) {
      return { ...post, can_edit: true };
    }
    // Also check for admin role if needed, but for now just author
    if (this.authService.isAdmin()) {
        return { ...post, can_edit: true };
    }
    return post;
  }

  private enrichTopicWithPermissions(topic: Topic): Topic {
    const currentUser = this.authService.currentUser();
    let canEdit = false;

    if (currentUser && currentUser.id === topic.author_user_id) {
      canEdit = true;
    }
    if (this.authService.isAdmin()) {
      canEdit = true;
    }

    return { ...topic, can_edit: canEdit };
  }
}
